### Lightning-Fast Medical Consultation Simulation with Nouky's Consultation Agent

https://noukai.streamlit.app


## Inspiration

The inspiration behind Nouky's Consultation Agent came from the need for a practical, interactive learning tool to help medical and pharmacy students improve their diagnostic skills and prepare for competitive exams. This agent serves as a foundational component for the final app, Nouky, which will feature a Leitner system for spaced repetition and advanced exam simulations to help students prepare for various medical and pharmacy competitions, including the Concours d'internat de pharmacie in France.

## What it does

Nouky's Consultation Agent is an intelligent tool that simulates medical consultations. Acting as a fictional patient with diverse symptoms, it enables students to ask questions, gather information, and make a diagnosis. The agent also provides feedback on diagnoses to help students refine their skills. In the final Nouky app, this feature will be integrated with a Leitner system to reinforce learning through spaced repetition, as well as a retrieval-augmented generation (RAG) system powered by a custom dataset of past exam questions from France’s pharmacy and medical competitions.

## How we built it

Nouky's Consultation Agent was built using Streamlit for the user interface and SambaNova's API for language generation capabilities. The agent’s architecture allows for smooth, realistic interactions between students and the AI, with responses tailored to students’ inquiries. 

**SambaNova's** language models enabled us to develop accurate and contextually relevant dialogues, while Streamlit provided an easy-to-use interface. 


## Challenges we ran into

We faced several challenges, including prompt engineering and fine-tuning parameters to optimize the agent’s responses and ensure they were both fast and accurate. Structuring Nouky's Consultation Agent to create a realistic and meaningful consultation experience required careful crafting of prompts and system messages. Developing the agent’s capabilities to provide meaningful feedback on students’ diagnoses was also a meticulous process to ensure the AI offered valuable guidance. Additionally, while the RAG system and custom dataset are planned for the final Nouky app, conceptualizing their structure and integration, along with designing an effective Leitner-based repetition system, presented additional challenges that helped shape our approach for future development.

## Accomplishments that we're proud of

We are proud to have developed Nouky's Consultation Agent as a realistic, fast simulation tool that allows students to practice diagnostic skills. Tested and validated by medical students at various levels (Master’s, PhD) thanks to student's support, the agent’s ability to provide structured, constructive feedback transforms it into an effective learning aid. Additionally, designing a roadmap for the full Nouky app, which will include spaced repetition and exam simulations using our custom dataset, represents a significant accomplishment and sets the stage for a comprehensive educational platform.

## What we learned

We learned how to utilize high-performance language models from SambaNova to enable real-time, relevant interactions. Additionally, we gained experience in designing educational tools with Streamlit, specifically for the medical field. Conceptually, we explored how a Leitner system could enhance retention for exam preparation and how RAG can be applied to reference an extensive dataset, like the Concours d'internat de pharmacie, for more targeted responses in future versions of Nouky.

## What's next for Nouky


The next steps for Nouky's Consultation Agent include expanding its library of cases and enhancing feedback mechanisms. As we integrate this agent into the full Nouky app, we’ll incorporate a Leitner-based spaced repetition system to help students reinforce learning over time. Additionally, we plan to implement a retrieval-augmented generation (RAG) model that utilizes a custom dataset from the Concours d'internat de pharmacie in France to simulate realistic exam questions across medical and pharmacy disciplines. Ultimately, Nouky's Consultation Agent will evolve into a central feature of Nouky, a comprehensive study assistant designed to support medical and pharmacy students in preparing for competitive exams.

