"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useStore } from "@/store";
import type { User } from "@/types";
import { buildFullPhoneNumber, isValidLocalPhone } from "@/lib/utils";
import PhoneInput from "@/components/ui/PhoneInput";
import { MessageCircle, KeyRound, User as UserIcon, ChevronRight, ChevronLeft } from "lucide-react";

type Step = "phone" | "otp" | "profile" | "register";

export default function AuthPage() {
  const router = useRouter();
  const setAuth = useStore((s) => s.setAuth);
  const addToast = useStore((s) => s.addToast);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);

  const clearError = () => setError("");

  // ─── Step 1: Phone ───────────────────────────────────────

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    clearError();

    const fullPhone = buildFullPhoneNumber(phone);

    try {
      await authApi.login(fullPhone);
      setIsNewUser(false);
      setStep("otp");
      addToast("OTP sent! Use 123456", "info");
    } catch (err: unknown) {
      // If 404, user not found → registration flow
      const status = (err as { response?: { status: number } })?.response?.status;
      if (status === 404) {
        setIsNewUser(true);
        setStep("register");
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ─── Step register: Profile before OTP ───────────────────

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) { setError("Display name is required"); return; }
    setLoading(true);
    clearError();

    try {
      const fullPhone = buildFullPhoneNumber(phone);
      await authApi.register({
        phone_number: fullPhone,
        username: username.trim() || undefined,
        display_name: displayName.trim(),
      });
      setStep("otp");
      addToast("Account created! Use OTP 123456", "success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Step 2: OTP ─────────────────────────────────────────

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    clearError();

    try {
      const fullPhone = buildFullPhoneNumber(phone);
      const res = await authApi.verify(fullPhone, otp);
      const { token, user_id, username: uname, display_name } = res.data;

      const fallbackUser: User = {
        id: user_id,
        username: uname,
        phone_number: fullPhone,
        display_name,
        avatar_url: null,
        is_online: true,
        last_seen_at: null,
      };

      setAuth(token, fallbackUser);

      // Refresh the full profile after the token is persisted.
      try {
        const meRes = await authApi.me();
        setAuth(token, meRes.data);
      } catch {
        // Keep the verified session alive with the fallback profile.
      }

      addToast(`Welcome back, ${display_name}!`, "success");
      router.replace("/chat");
    } catch {
      setError("Invalid OTP. Remember: use 123456");
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <MessageCircle size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            {step === "phone" && "Signal"}
            {step === "register" && "Create Account"}
            {step === "otp" && "Verify Phone"}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
            {step === "phone" && "Enter your phone number to continue"}
            {step === "register" && "Set up your profile to get started"}
            {step === "otp" && (
              <>Enter the code sent to <strong style={{ color: "var(--text-primary)" }}>{buildFullPhoneNumber(phone)}</strong></>
            )}
          </p>
        </div>

        {/* Step: Phone */}
        {step === "phone" && (
          <form onSubmit={handlePhoneSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PhoneInput
              id="phone-input"
              value={phone}
              onChange={(digits) => { setPhone(digits); clearError(); }}
              autoFocus
            />

            {error && <p style={{ color: "var(--text-danger)", fontSize: 13 }}>{error}</p>}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !isValidLocalPhone(phone)}
              id="phone-submit-btn"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {loading ? <div className="spinner" /> : <>Continue <ChevronRight size={16} /></>}
            </button>
          </form>
        )}

        {/* Step: Register */}
        {step === "register" && (
          <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ position: "relative" }}>
              <UserIcon
                size={16}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
              />
              <input
                id="display-name-input"
                type="text"
                placeholder="Display name *"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); clearError(); }}
                required
                style={{ width: "100%", padding: "12px 12px 12px 38px", borderRadius: "var(--radius-md)", fontSize: 15 }}
                autoFocus
              />
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 15, pointerEvents: "none" }}>@</span>
              <input
                id="username-input"
                type="text"
                placeholder="Username (optional)"
                value={username}
                onChange={(e) => { setUsername(e.target.value); clearError(); }}
                style={{ width: "100%", padding: "12px 12px 12px 28px", borderRadius: "var(--radius-md)", fontSize: 15 }}
              />
            </div>

            {error && <p style={{ color: "var(--text-danger)", fontSize: 13 }}>{error}</p>}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !displayName.trim()}
              id="register-submit-btn"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {loading ? <div className="spinner" /> : <>Create Account <ChevronRight size={16} /></>}
            </button>
            <button
              type="button"
              onClick={() => { setStep("phone"); clearError(); }}
              className="btn-ghost"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%" }}
            >
              <ChevronLeft size={14} /> Change number
            </button>
          </form>
        )}

        {/* Step: OTP */}
        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                background: "var(--accent-muted)",
                border: "1px solid rgba(55,151,240,0.3)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                fontSize: 13,
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <KeyRound size={14} />
              Hint: the OTP is always <strong>123456</strong>
            </div>

            <div style={{ position: "relative" }}>
              <KeyRound
                size={16}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
              />
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); clearError(); }}
                required
                style={{
                  width: "100%",
                  padding: "12px 12px 12px 38px",
                  borderRadius: "var(--radius-md)",
                  fontSize: 20,
                  letterSpacing: 8,
                  textAlign: "center",
                  fontWeight: 700,
                }}
                autoFocus
              />
            </div>

            {error && <p style={{ color: "var(--text-danger)", fontSize: 13 }}>{error}</p>}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || otp.length < 4}
              id="otp-submit-btn"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {loading ? <div className="spinner" /> : <>Verify &amp; Sign In <ChevronRight size={16} /></>}
            </button>
            <button
              type="button"
              onClick={() => { setStep(isNewUser ? "register" : "phone"); setOtp(""); clearError(); }}
              className="btn-ghost"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%" }}
            >
              <ChevronLeft size={14} /> Back
            </button>
          </form>
        )}

        <p style={{ marginTop: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6 }}>
          By continuing, you agree to our Terms of Service.
          Your messages are end-to-end encrypted.
        </p>
      </div>
    </div>
  );
}
