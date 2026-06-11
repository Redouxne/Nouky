import AuthForm from "@/components/AuthForm";

export const metadata = {
  title: "Se connecter - Nouky",
  description: "Connecte-toi à ton compte Nouky",
};

export default function SignInPage() {
  return <AuthForm mode="signin" />;
}
