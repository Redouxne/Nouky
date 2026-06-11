import AuthForm from "@/components/AuthForm";

export const metadata = {
  title: "Créer un compte - Nouky",
  description: "Crée ton compte Nouky",
};

export default function SignUpPage() {
  return <AuthForm mode="signup" />;
}
