"use client"

import { Suspense, useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { authClient, useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { GradientBackground } from "@/components/gradient-background"
import { LocaleToggle } from "@/components/locale-toggle"
import { LandingLocaleProvider, useLandingLocale } from "@/components/home/use-landing-locale"
import { getDeviceLabels } from "./device-labels"

type Step = "loading" | "code" | "approve" | "done" | "denied"

export default function DeviceAuthPage() {
  return (
    <Suspense>
      <LandingLocaleProvider>
        <DeviceAuthPageInner />
      </LandingLocaleProvider>
    </Suspense>
  )
}

function DeviceAuthPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { locale } = useLandingLocale()
  const labels = getDeviceLabels(locale)

  const urlCode = searchParams.get("user_code") || ""
  const [userCode, setUserCode] = useState(urlCode)
  const [step, setStep] = useState<Step>(urlCode ? "loading" : "code")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const autoVerified = useRef(false)

  useEffect(() => {
    if (!isPending && !session) {
      const callbackUrl = `/device${userCode ? `?user_code=${encodeURIComponent(userCode)}` : ""}`
      router.push(`/sign-in?redirect=${encodeURIComponent(callbackUrl)}`)
    }
  }, [isPending, session, router, userCode])

  useEffect(() => {
    if (!urlCode || !session || autoVerified.current) return
    autoVerified.current = true

    async function autoVerify() {
      try {
        const res = await authClient.device({ query: { user_code: urlCode.trim() } })
        if (res.error) {
          setError(res.error.error_description || labels.errors.invalidOrExpired)
          setStep("code")
        } else {
          setStep("approve")
        }
      } catch {
        setError(labels.errors.verifyFailed)
        setStep("code")
      }
    }

    autoVerify()
  }, [urlCode, session, labels])

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await authClient.device({ query: { user_code: userCode.trim() } })
      if (res.error) {
        setError(res.error.error_description || labels.errors.invalidOrExpired)
      } else {
        setStep("approve")
      }
    } catch {
      setError(labels.errors.verifyFailed)
    }
    setLoading(false)
  }

  async function handleApprove() {
    setError("")
    setLoading(true)
    try {
      const res = await authClient.device.approve({ userCode: userCode.trim() })
      if (res.error) {
        setError(res.error.error_description || labels.errors.approveFailed)
      } else {
        setStep("done")
      }
    } catch {
      setError(labels.errors.approveDeviceFailed)
    }
    setLoading(false)
  }

  async function handleDeny() {
    setError("")
    setLoading(true)
    try {
      await authClient.device.deny({ userCode: userCode.trim() })
      setStep("denied")
    } catch {
      setError(labels.errors.denyDeviceFailed)
    }
    setLoading(false)
  }

  if (isPending || !session) {
    return null
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <GradientBackground />
      <div className="absolute right-4 top-4">
        <LocaleToggle />
      </div>
      <div className="w-full max-w-sm">
        <Card>
          <CardContent className="p-6">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">{labels.heading}</h1>
                {step === "loading" && (
                  <p className="text-sm text-muted-foreground">
                    {labels.verifying}
                  </p>
                )}
                {step === "code" && (
                  <p className="text-sm text-muted-foreground">
                    {labels.enterCode}
                  </p>
                )}
                {step === "approve" && (
                  <p className="text-sm text-muted-foreground">
                    {labels.requestingAccess}
                  </p>
                )}
              </div>

              {error && <FieldError>{error}</FieldError>}

              {step === "loading" && (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}

              {step === "code" && (
                <form onSubmit={handleVerifyCode}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="user_code">{labels.deviceCode}</FieldLabel>
                      <Input
                        id="user_code"
                        type="text"
                        placeholder="XXXX-XXXX"
                        value={userCode}
                        onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                        required
                        autoFocus
                        className="text-center text-lg tracking-widest font-mono"
                      />
                    </Field>
                    <Field>
                      <Button type="submit" disabled={loading || !userCode.trim()} className="w-full">
                        {loading ? labels.verifying : labels.verifyCode}
                      </Button>
                    </Field>
                  </FieldGroup>
                </form>
              )}

              {step === "approve" && (
                <FieldGroup>
                  <p className="text-sm text-center text-muted-foreground">
                    {labels.code}: <strong className="font-mono">{userCode}</strong>
                  </p>
                  <Field className="grid grid-cols-2 gap-4">
                    <Button variant="outline" onClick={handleDeny} disabled={loading}>
                      {labels.deny}
                    </Button>
                    <Button onClick={handleApprove} disabled={loading}>
                      {loading ? labels.approving : labels.approve}
                    </Button>
                  </Field>
                </FieldGroup>
              )}

              {step === "done" && (
                <div className="text-center space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-green-600">{labels.deviceAuthorized}</p>
                    <p className="text-sm text-muted-foreground">
                      {labels.doneCli}
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => router.push("/workspaces")}
                  >
                    {labels.openDashboard}
                  </Button>
                </div>
              )}

              {step === "denied" && (
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {labels.accessDenied}
                  </p>
                </div>
              )}
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
