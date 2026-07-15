"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { signIn, signUp, authClient } from "@/lib/auth-client"
import { parseRetryAfterSeconds } from "@/lib/retry-after"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { SiGoogle } from "@icons-pack/react-simple-icons"
import Image from "next/image"
import { GradientBackground } from "@/components/gradient-background"
import { Logo } from "@/components/logo"
import { DEV_PASSWORD } from "@phneakngar/shared"
import { cn } from "@/lib/utils"
import {
  SIGN_IN_LABELS,
  showImageAriaLabel,
  tooManyRequestsLabel,
  waitSecondsLabel,
} from "./sign-in-labels"

const DEFAULT_POST_LOGIN = "/workspaces?auto"

function safeRedirectUrl(redirect: string | null): string {
  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect
  }
  return DEFAULT_POST_LOGIN
}

function SignInForm({ postLoginUrl, isProd }: { postLoginUrl: string; isProd: boolean }) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const [code, setCode] = useState("")
  const [step, setStep] = useState<"email" | "code">("email")
  const [retryAfter, setRetryAfter] = useState<number | null>(null)

  useEffect(() => {
    if (retryAfter == null) return
    const id = setTimeout(() => {
      setRetryAfter((v) => (v == null || v <= 1 ? null : v - 1))
    }, 1000)
    return () => clearTimeout(id)
  }, [retryAfter])

  const rateLimitHandler = {
    onError: (ctx: { response: Response }) => {
      if (ctx.response.status === 429) {
        const seconds = parseRetryAfterSeconds(ctx.response.headers)
        if (seconds != null) setRetryAfter(seconds)
      }
    },
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (retryAfter != null) return
    setError("")
    setRetryAfter(null)
    setLoading(true)
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
        fetchOptions: rateLimitHandler,
      })
      if (error) {
        if (error.status !== 429) setError(error.message ?? SIGN_IN_LABELS.error.failedToSendCode)
      } else {
        setStep("code")
      }
    } catch {
      setError(SIGN_IN_LABELS.error.failedToSendCode)
    }
    setLoading(false)
  }

  async function handleVerifyCode(value: string) {
    setCode(value)
    if (value.length !== 6) return

    setError("")
    setLoading(true)
    try {
      const { error } = await authClient.signIn.emailOtp({
        email,
        otp: value,
      })
      if (error) {
        setError(error.message ?? SIGN_IN_LABELS.error.invalidCode)
        setCode("")
      } else {
        window.location.href = postLoginUrl
        return
      }
    } catch {
      setError(SIGN_IN_LABELS.error.invalidCode)
      setCode("")
    }
    setLoading(false)
  }

  async function handleDevSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const { error: signInErr } = await signIn.email(
      { email, password: DEV_PASSWORD },
      { onError: () => {} },
    )
    if (signInErr) {
      const { error: signUpErr } = await signUp.email(
        { name: email.split("@")[0], email, password: DEV_PASSWORD },
        { onError: () => {} },
      )
      if (signUpErr) {
        setError(signUpErr.message ?? SIGN_IN_LABELS.error.failedToSignIn)
        setLoading(false)
        return
      }
    }
    window.location.href = postLoginUrl
  }

  const isCoolingDown = retryAfter != null
  const sendLabel = loading
    ? SIGN_IN_LABELS.action.sending
    : isCoolingDown
    ? waitSecondsLabel(retryAfter)
    : SIGN_IN_LABELS.action.sendCode

  const subtitle = isProd && step === "code"
    ? SIGN_IN_LABELS.prompt.enterCode
    : isProd
    ? SIGN_IN_LABELS.prompt.enterEmail
    : undefined

  return (
    <FieldGroup>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{SIGN_IN_LABELS.title}</h1>
        <p className="max-w-64 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          {SIGN_IN_LABELS.subtitle}
        </p>
        {subtitle && (
          <p className="text-balance text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{subtitle}</p>
        )}
      </div>

      {isCoolingDown && (
        <FieldError>
          {tooManyRequestsLabel(retryAfter)}
        </FieldError>
      )}
      {error && !isCoolingDown && <FieldError>{error}</FieldError>}

      {isProd ? (
        step === "email" ? (
          <form onSubmit={handleSendCode}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">{SIGN_IN_LABELS.field.email}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <Button
                  type="submit"
                  disabled={loading || isCoolingDown}
                  className="h-10 w-full"
                >
                  {sendLabel}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        ) : (
          <>
            <p className="text-sm text-muted-foreground text-center">
              {SIGN_IN_LABELS.sentCodeToPrefix}<strong>{email}</strong>
            </p>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={handleVerifyCode}
                disabled={loading}
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("email")
                setCode("")
                setError("")
              }}
            >
              {SIGN_IN_LABELS.action.useDifferentEmail}
            </Button>
          </>
        )
      ) : (
        <form onSubmit={handleDevSignIn}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">{SIGN_IN_LABELS.field.email}</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field>
              <Button type="submit" disabled={loading} className="h-10 w-full">
                {loading ? SIGN_IN_LABELS.action.signingIn : SIGN_IN_LABELS.action.signIn}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      )}

      <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
        {SIGN_IN_LABELS.action.orContinueWith}
      </FieldSeparator>
      <Field >
        <Button
          variant="outline"
          type="button"
          className="h-10 w-full"
          onClick={() =>
            signIn.social({ provider: "google", callbackURL: postLoginUrl })
          }
        >
          <SiGoogle className="size-4" />
          Google
        </Button>
      </Field>
    </FieldGroup>
  )
}

const galleryImages = [
  { src: "/gallery/collaboration.png", label: SIGN_IN_LABELS.gallery.collaboration },
  { src: "/gallery/email.png", label: SIGN_IN_LABELS.gallery.emailInbox },
  { src: "/gallery/issues.png", label: SIGN_IN_LABELS.gallery.kanbanBoard },
  { src: "/gallery/calendar.png", label: SIGN_IN_LABELS.gallery.calendar },
  { src: "/gallery/local-agent.png", label: SIGN_IN_LABELS.gallery.localAgent },
]

function ProductGallery() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((i) => (i + 1) % galleryImages.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex h-full flex-col justify-between p-5">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          {SIGN_IN_LABELS.surface.galleryTitle}
        </p>
        <p className="text-lg font-semibold tracking-tight text-foreground">
          {galleryImages[active].label}
        </p>
      </div>
      <div className="relative mt-5 w-full overflow-hidden rounded-lg border border-border/70 bg-background/70 shadow-[0_18px_45px_-30px_oklch(0.2_0.01_60/45%)]">
        {galleryImages.map((img, i) => (
          <Image
            key={img.src}
            src={img.src}
            alt={img.label}
            width={600}
            height={450}
            className="w-full h-auto transition-opacity duration-500"
            style={{
              opacity: i === active ? 1 : 0,
              position: i === 0 ? "relative" : "absolute",
              top: 0,
              left: 0,
            }}
            priority={i === 0}
          />
        ))}
      </div>
      <div className="mt-4 flex gap-1.5">
        {galleryImages.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setActive(i)}
            className="h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            style={{
              width: i === active ? 16 : 6,
              backgroundColor: i === active
                ? "var(--primary)"
                : "var(--muted-foreground)",
              opacity: i === active ? 1 : 0.3,
            }}
            aria-label={showImageAriaLabel(galleryImages[i].label)}
          />
        ))}
      </div>
    </div>
  )
}

function SurfaceDetail({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-foreground/10 bg-background/55 px-2.5 py-1.5 text-xs leading-none text-muted-foreground",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-primary/70" aria-hidden />
      {children}
    </span>
  )
}

export default function SignInPageClient({ isProd }: { isProd: boolean }) {
  const searchParams = useSearchParams()
  const postLoginUrl = safeRedirectUrl(searchParams.get("redirect"))

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center p-4 sm:p-6 md:p-10">
      <GradientBackground />
      <div className="w-[calc(100vw-2rem)] max-w-sm md:w-full md:max-w-4xl">
        <div className="mb-5 flex justify-center">
          <Logo size="lg" />
        </div>
        <Card className="rounded-lg border border-foreground/10 bg-card/92 p-0 shadow-[0_24px_80px_-55px_oklch(0.2_0.01_60/65%)] backdrop-blur">
          <CardContent className="grid p-0 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="flex min-h-[430px] min-w-0 flex-col justify-center p-6 sm:p-8">
              <div className="mb-7 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {SIGN_IN_LABELS.surface.status}
                </p>
                <div className="space-y-2">
                  <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
                    {SIGN_IN_LABELS.surface.heading}
                  </h2>
                  <p className="text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]">
                    {SIGN_IN_LABELS.surface.detail}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <SurfaceDetail>{SIGN_IN_LABELS.surface.email}</SurfaceDetail>
                  <SurfaceDetail>{SIGN_IN_LABELS.surface.local}</SurfaceDetail>
                </div>
              </div>
              <div className="min-w-0 border-t border-border/70 pt-6">
                <SignInForm postLoginUrl={postLoginUrl} isProd={isProd} />
              </div>
            </div>
            <div className="relative hidden min-h-[430px] overflow-hidden border-l border-border/70 bg-muted/55 md:block">
              <ProductGallery />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
