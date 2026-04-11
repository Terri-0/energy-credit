import { useState } from "react";
import { Battery } from "lucide-react";
import client from "../api/client";
import { apiError } from "../constants";
import { Card, PrimaryBtn, FormInput, ErrMsg } from "../components/ui";

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => {
    setError("");
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const body =
        mode === "login"
          ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password };
      const { data } = await client.post(path, body);
      onAuth(data.token, data.user);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const ready =
    mode === "login"
      ? form.email && form.password.length >= 8
      : form.name && form.email && form.password.length >= 8;

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-50"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#38bdf8,#0ea5e9)" }}
          >
            <Battery size={20} className="text-white" />
          </div>
          <div>
            <p className="font-black text-slate-900 text-lg leading-none">EnergyCredit</p>
            <p className="text-xs text-slate-400">Solar Trading Platform</p>
          </div>
        </div>

        <Card className="p-7 space-y-5">
          <p className="text-lg font-black text-slate-900">
            {mode === "login" ? "Sign in" : "Create account"}
          </p>

          {mode === "register" && (
            <FormInput label="Full Name" value={form.name} onChange={set("name")} placeholder="Jane Smith" />
          )}
          <FormInput label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
          <FormInput
            label="Password"
            type="password"
            value={form.password}
            onChange={set("password")}
            placeholder={mode === "register" ? "Min 8 characters" : "••••••••"}
          />

          <ErrMsg msg={error} />

          <PrimaryBtn onClick={submit} disabled={loading || !ready} className="w-full py-3 text-base">
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </PrimaryBtn>

          <p className="text-center text-sm text-slate-400">
            {mode === "login" ? "No account?" : "Already have an account?"}{" "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="font-semibold text-sky-500 hover:text-sky-600"
            >
              {mode === "login" ? "Register" : "Sign in"}
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
}
