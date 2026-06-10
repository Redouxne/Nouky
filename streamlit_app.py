import streamlit as st
import requests
import os


st.title("👩‍⚕️🩺 Medical Consultation Simulation with Nouky")
st.write(
    """
Welcome to the consultation simulation! Nouky will pretend to be a patient with fictitious symptoms. Ask questions, make your diagnosis, and propose a treatment !
"""
)


api_key = os.environ.get("SAMBANOVA_API_KEY", "X")
base_url = "https://api.sambanova.ai/v1"


headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
}

# Select the type of consultation
consultation_type = st.selectbox(
    "Choose a consultation type:",
    [
        "Cardiology",
        "Pulmonology",
        "Gastroenterology",
        "Neurology",
        "Dermatology",
        "Endocrinology",
    ],
)

# Generate the disease and symptoms only after the consultation type is selected
if consultation_type:
    # Function to generate a random disease and its symptoms using the LLM
    def generate_disease_and_symptoms(consultation_type):
        # Prompt to generate a random disease
        disease_prompt = (
            f"Randomly choose the names of 10 diseases in {consultation_type}, "
            f"without any preference or bias, and provide only their names. "
            f"Do not take only the 10 most common ones. "
            f"Randomly select one of these 10 diseases and give me only its name."
        )

        disease_payload = {
            "model": "Meta-Llama-3.1-70B-Instruct",
            "messages": [{"role": "user", "content": disease_prompt}],
            "temperature": 1.0,  # Increased for more randomness
            "top_p": 0.9,
        }

        # API call to get the disease
        try:
            disease_response = requests.post(
                f"{base_url}/chat/completions", headers=headers, json=disease_payload
            )
            disease_response.raise_for_status()
            disease = disease_response.json()["choices"][0]["message"]["content"].strip()

            # Ensure only the disease name is returned
            disease = disease.split("\n")[-1].strip()
        except requests.exceptions.RequestException as e:
            st.error(f"Error generating the disease: {e}")
            return None, None

        # Prompt to generate symptoms without mentioning the disease name
        symptoms_prompt = (
            f"Without mentioning the name of the disease, list 3 common symptoms "
            f"of a disease in {consultation_type} corresponding to: {disease}. "
            f"Express yourself as a patient and be concise."
        )
        symptoms_payload = {
            "model": "Meta-Llama-3.1-70B-Instruct",
            "messages": [{"role": "user", "content": symptoms_prompt}],
            "temperature": 0.9,
            "top_p": 0.9,
        }

        # API call to get the symptoms
        try:
            symptoms_response = requests.post(
                f"{base_url}/chat/completions", headers=headers, json=symptoms_payload
            )
            symptoms_response.raise_for_status()
            symptoms_text = symptoms_response.json()["choices"][0]["message"]["content"].strip()

            # Process the response to ensure the disease name is not included
            symptoms_text = symptoms_text.replace(disease, "").strip(":,-. ")

            # Extract symptoms from the response
            symptoms_list = [
                symptom.strip("0123456789.:- ")
                for symptom in symptoms_text.split("\n")
                if symptom.strip()
            ]
            if len(symptoms_list) < 3:
                symptoms_list = symptoms_text.replace(",", "\n").split("\n")
                symptoms_list = [
                    symptom.strip("0123456789.:- ") for symptom in symptoms_list if symptom.strip()
                ]
        except requests.exceptions.RequestException as e:
            st.error(f"Error generating the symptoms: {e}")
            return disease, None

        return disease, symptoms_list[:3]  # Return only the first 3 symptoms

    # Generate the disease and symptoms if not already done
    if (
        "disease" not in st.session_state
        or st.session_state.consultation_type != consultation_type
    ):
        st.session_state.disease, st.session_state.selected_symptoms = generate_disease_and_symptoms(
            consultation_type
        )
        st.session_state.consultation_type = consultation_type

    disease = st.session_state.disease
    selected_symptoms = st.session_state.selected_symptoms

    if disease and selected_symptoms:
        symptoms_text = ", ".join(selected_symptoms)
        st.write(f"The patient presents to you with the following symptoms: **{symptoms_text}** ")
    else:
        st.stop()

    # Session state to store chat messages
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Check if the system message has already been added
    if not any(msg["role"] == "system" for msg in st.session_state.messages):
        # Add the system message with consultation information
        st.session_state.messages.append(
            {
                "role": "system",
                "content": f"""You are portraying a patient during a consultation in {consultation_type}.
Your symptoms are: {symptoms_text} related to a disease that you are unaware of.
Your goal is to provide detailed and coherent answers to the medical student's questions without directly revealing your diagnosis.

- Respond naturally, as a real patient would.
- Provide only the information in response to the questions asked, without adding unsolicited details.
- If a question is unclear or requires clarification, do not hesitate to ask for more information.
- Avoid using medical or technical language; express yourself in your own words.
- Do not reveal the exact name of the disease or diagnosis (you are unaware of it anyway).

Your role is to help the student gather enough information so that they can make an accurate diagnosis by asking the right questions.""",
            }
        )

    def ChatFull():
        with st.container():
            # Display chat history
            for message in st.session_state.messages:
                if message["role"] == "assistant":
                    # Patient's message with image
                    col1, col2 = st.columns([1, 8])
                    with col1:
                        st.image("Leoard.png", width=50)  # Patient's picture
                    with col2:
                        st.markdown(
                            f"""
                            <div style="background-color: #f0f2f6; padding: 1rem; border-radius: 0.5rem; max-width: 100%; margin-bottom: 1rem;">
                                {message['content']}
                            </div>
                            """,
                            unsafe_allow_html=True,
                        )
                elif message["role"] == "user":
                    # User's message with image
                    col1, col2 = st.columns([8, 1])
                    with col2:
                        st.image("usericon.png", width=50)  # User's picture
                    with col1:
                        st.markdown(
                            f"""
                            <div style="background-color: #e8f4ff; padding: 1rem; border-radius: 0.5rem; max-width: 100%; margin-bottom: 1rem; text-align: right;">
                                {message['content']}
                            </div>
                            """,
                            unsafe_allow_html=True,
                        )

            # Function to detect if the user is requesting a medical test
            def is_test_request(message):
                test_keywords = [
                    "test", "analysis", "exam", "imaging", "mri", "x-ray",
                    "blood test", "panel", "scan", "ultrasound", "ecg", "echocardiogram"
                ]
                return any(keyword in message.lower() for keyword in test_keywords)

            # Function to handle user input
            def submit_message():
                chat_input = st.session_state.chat_input
                if chat_input:
                    # Store the user's question
                    st.session_state.messages.append({"role": "user", "content": chat_input})

                    # Check if it's a test request
                    if is_test_request(chat_input):
                        # Prepare the prompt for the test agent
                        test_agent_prompt = {
                            "role": "system",
                            "content": f"""You are a medical assistant providing medical test results.
    The patient has the following symptoms: {symptoms_text} and has this disease: {disease}
    Provide medical test results that are consistent with these symptoms and this disease.
    Respond professionally and precisely, providing relevant values.
    If multiple tests are requested, provide results for each.

    Do not disclose the name of the disease; just give the results as a laboratory would. Do not analyze the results.""",
                        }
                        # Prepare messages for the test agent
                        test_messages = [test_agent_prompt] + st.session_state.messages[-1:]

                        # Prepare the API request for the test agent
                        payload = {
                            "model": "Meta-Llama-3.1-70B-Instruct",
                            "messages": test_messages,
                            "temperature": 0.5,
                            "top_p": 0.9,
                        }
                    else:
                        # Use the default patient agent
                        payload = {
                            "model": "Meta-Llama-3.1-70B-Instruct",
                            "messages": st.session_state.messages,
                            "temperature": 0.5,
                            "top_p": 0.9,
                        }

                    # Send the request to the API
                    try:
                        response = requests.post(
                            f"{base_url}/chat/completions", headers=headers, json=payload
                        )
                        response.raise_for_status()
                        assistant_reply = response.json()["choices"][0]["message"]["content"]

                        # Add the assistant's response
                        st.session_state.messages.append({"role": "assistant", "content": assistant_reply})

                    except requests.exceptions.RequestException as e:
                        st.error(f"Error communicating with the SambaNova API: {e}")

                    # Reset the input field
                    st.session_state.chat_input = ''
                else:
                    st.warning("Please enter a question before sending.")

            # Chat input field with on_change callback
            st.text_input("Ask your question to the patient:", key='chat_input', on_change=submit_message)




    ChatFull()

    # Diagnostic Section
    st.write("### Provide a final diagnosis and propose a treatment")
    diagnostic_input = st.text_input(
        "What is your diagnosis and treatment for this patient?", key="diagnostic_input"
    )

    # Button to submit the diagnostic
    if st.button("Submit", key="submit_diagnostic"):
        if diagnostic_input:
            # Add the diagnostic to the chat history
            st.session_state.messages.append(
                {"role": "user", "content": f"Proposed diagnosis: {diagnostic_input}"}
            )

            # Prompt for diagnostic evaluation
            feedback_prompt = f"""You are an examiner evaluating the diagnosis and treatment proposed by a medical student.
The patient has the following symptoms: {symptoms_text}. The disease is {disease}
Assess whether the proposed diagnosis matches the patient's condition.
Also evaluate if the proposed treatment is appropriate for this condition.
Mention the exact name of the disease in your response.
Provide a brief feedback indicating whether the diagnosis and treatment are correct."""

            # Prepare the API request
            payload = {
                "model": "Meta-Llama-3.1-70B-Instruct",
                "messages": st.session_state.messages + [
                    {"role": "system", "content": feedback_prompt}
                ],
                "temperature": 0.5,
                "top_p": 0.9,
            }

            try:
                response = requests.post(
                    f"{base_url}/chat/completions", headers=headers, json=payload
                )
                response.raise_for_status()
                feedback_reply = response.json()["choices"][0]["message"]["content"]

                # Display the feedback
                st.write("### Diagnosis Evaluation")
                st.write(feedback_reply)

                # Add the feedback to the session state
                st.session_state.messages.append({"role": "assistant", "content": feedback_reply})

            except requests.exceptions.RequestException as e:
                st.error(f"Error submitting the diagnosis: {e}")
        else:
            st.warning("Please enter a diagnosis before submitting.")



