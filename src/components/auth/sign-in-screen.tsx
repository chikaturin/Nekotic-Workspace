"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authService } from "@/services/auth-service";
import { toAppError } from "@/services/errors";
import { useSessionStore } from "@/store/session-store";

type Mode = "sign-in" | "register";

const COPY: Record<Mode, { title: string; action: string; switchTo: string }> = {
  "sign-in": {
    title: "Đăng nhập",
    action: "Đăng nhập",
    switchTo: "Chưa có tài khoản? Đăng ký",
  },
  register: {
    title: "Tạo tài khoản",
    action: "Tạo tài khoản",
    switchTo: "Đã có tài khoản? Đăng nhập",
  },
};

export function SignInScreen() {
  const signIn = useSessionStore((state) => state.signIn);

  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const copy = COPY[mode];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy) return;

    setIsBusy(true);
    setError(null);

    try {
      if (mode === "register") {
        await authService.register({ email, password, name });
      }

      signIn(await authService.login({ email, password }));
    } catch (cause) {
      setError(toAppError(cause).message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <form
        onSubmit={(event) => void submit(event)}
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-raise"
      >
        <h1 className="mb-1 text-title font-semibold text-foreground">
          {copy.title}
        </h1>
        <p className="mb-5 text-body text-muted-foreground">Nekotic Workspace</p>

        <div className="space-y-4">
          {mode === "register" && (
            <FormField label="Tên hiển thị" isRequired>
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  autoComplete="name"
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </FormField>
          )}

          <FormField label="Email" isRequired>
            {(props) => (
              <Input
                {...props}
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </FormField>

          <FormField label="Mật khẩu" isRequired error={error ?? undefined}>
            {(props) => (
              <Input
                {...props}
                type="password"
                value={password}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </FormField>
        </div>

        <Button
          type="submit"
          variant="default"
          disabled={isBusy}
          className="mt-5 w-full"
        >
          {isBusy ? <Spinner /> : null}
          {copy.action}
        </Button>

        <Button
          type="button"
          variant="link"
          className="mt-3 w-full"
          onClick={() => {
            setMode(mode === "sign-in" ? "register" : "sign-in");
            setError(null);
          }}
        >
          {copy.switchTo}
        </Button>
      </form>
    </div>
  );
}
