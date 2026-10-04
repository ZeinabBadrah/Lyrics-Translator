"use client";

import { useEffect, useId, useState } from "react";

import {
  Alert,
  Button,
  Field,
  PageHeading,
  Select,
  TextInput,
} from "@/components/ui";
import { requestTranslation, requestUsage } from "@/lib/api-client";
import { DEFAULT_SETTINGS, getSettings, saveSettings } from "@/lib/db";
import { detectPlanFromKey } from "@/lib/deepl";
import { TARGET_LANGUAGES } from "@/lib/languages";
import { applyTheme, writeStoredTheme } from "@/lib/theme";
import type {
  DeeplApiPlanSetting,
  Settings,
  ThemePreference,
  UsageResponseBody,
} from "@/types";

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; usage?: UsageResponseBody }
  | { status: "failed"; message: string };

export default function SettingsPage() {
  const keyFieldId = useId();
  const planFieldId = useId();
  const languageFieldId = useId();
  const themeFieldId = useId();

  const [form, setForm] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyError, setKeyError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    void getSettings()
      .then((settings) => {
        if (!cancelled) setForm(settings);
      })
      .catch(() => {
        // Fall back to defaults; the user can still enter a key.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
    // A changed key invalidates whatever the last test proved.
    if (key === "deeplApiKey" || key === "deeplApiPlan") {
      setTest({ status: "idle" });
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    if (!form.deeplApiKey.trim()) {
      setKeyError("A DeepL API key is required.");
      return;
    }

    setKeyError(undefined);
    const next = await saveSettings({
      ...form,
      deeplApiKey: form.deeplApiKey.trim(),
    });

    // Mirror the theme so the pre-paint script picks it up on the next load.
    writeStoredTheme(next.theme);
    applyTheme(next.theme);
    setSaved(true);
  }

  async function handleTest() {
    const apiKey = form.deeplApiKey.trim();
    if (!apiKey) {
      setKeyError("Enter a key before testing it.");
      return;
    }

    setKeyError(undefined);
    setTest({ status: "testing" });

    try {
      // One short word is the cheapest request that still proves the key works.
      await requestTranslation({
        text: ["hello"],
        targetLang: form.defaultTargetLanguage,
        apiKey,
        apiPlan: form.deeplApiPlan,
      });

      // The key works. Usage is a bonus, so a failure here is not a failed test.
      let usage: UsageResponseBody | undefined;
      try {
        usage = await requestUsage(apiKey, form.deeplApiPlan);
      } catch {
        usage = undefined;
      }

      setTest({ status: "ok", usage });
    } catch (error) {
      setTest({
        status: "failed",
        message:
          error instanceof Error ? error.message : "The connection test failed.",
      });
    }
  }

  const detectedPlan = form.deeplApiKey.trim()
    ? detectPlanFromKey(form.deeplApiKey)
    : undefined;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <PageHeading
        title="Settings"
        description={
          <>
            Get a free API key at{" "}
            <a
              className="text-accent underline underline-offset-2"
              href="https://www.deepl.com/pro-api"
              target="_blank"
              rel="noreferrer"
            >
              deepl.com/pro-api
            </a>
            . Your key is stored only in this browser and is never sent anywhere
            except to DeepL.
          </>
        }
      />

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <Field
          label="DeepL API key"
          htmlFor={keyFieldId}
          error={keyError}
          hint="Free keys end in “:fx”."
        >
          <div className="flex gap-2">
            <TextInput
              id={keyFieldId}
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={loaded ? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx" : "Loading…"}
              value={form.deeplApiKey}
              onChange={(event) => update("deeplApiKey", event.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowKey((previous) => !previous)}
              aria-pressed={showKey}
            >
              {showKey ? "Hide" : "Show"}
            </Button>
          </div>
        </Field>

        <Field
          label="API plan"
          htmlFor={planFieldId}
          hint={
            form.deeplApiPlan === "auto" && detectedPlan
              ? `Detected: ${detectedPlan === "free" ? "Free" : "Pro"}, from the key’s format.`
              : "Free and Pro keys use different DeepL endpoints."
          }
        >
          <Select
            id={planFieldId}
            value={form.deeplApiPlan}
            onChange={(event) =>
              update("deeplApiPlan", event.target.value as DeeplApiPlanSetting)
            }
          >
            <option value="auto">Detect from my key</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </Select>
        </Field>

        <Field
          label="Default target language"
          htmlFor={languageFieldId}
          hint="The language you are learning. Used for every new song."
        >
          <Select
            id={languageFieldId}
            value={form.defaultTargetLanguage}
            onChange={(event) =>
              update("defaultTargetLanguage", event.target.value)
            }
          >
            {TARGET_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Appearance" htmlFor={themeFieldId}>
          <Select
            id={themeFieldId}
            value={form.theme}
            onChange={(event) => {
              const theme = event.target.value as ThemePreference;
              update("theme", theme);
              // Preview immediately; the choice is only persisted on save.
              applyTheme(theme);
            }}
          >
            <option value="system">Match my system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Save settings</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleTest}
            disabled={test.status === "testing"}
          >
            {test.status === "testing" ? "Testing…" : "Test connection"}
          </Button>
        </div>

        {saved && <Alert tone="success">Settings saved to this browser.</Alert>}

        {test.status === "ok" && (
          <Alert tone="success">
            Your key works.
            {test.usage &&
              (test.usage.unlimited ? (
                <> This key has no character limit.</>
              ) : (
                <>
                  {" "}
                  You have used{" "}
                  <strong>
                    {test.usage.characterCount.toLocaleString()}
                  </strong>{" "}
                  of {test.usage.characterLimit.toLocaleString()} characters
                  this billing period.
                </>
              ))}
          </Alert>
        )}

        {test.status === "failed" && <Alert tone="error">{test.message}</Alert>}
      </form>

      <section className="flex flex-col gap-2 border-t border-border pt-6 text-xs/5 text-muted">
        <h2 className="text-sm font-medium text-foreground">
          Where your data lives
        </h2>
        <p>
          Songs, vocabulary and this key are stored in this browser&rsquo;s
          IndexedDB. Nothing is uploaded, and there is no account. Clearing your
          browser&rsquo;s site data for this site deletes all of it.
        </p>
        <p>
          The key is stored unencrypted, as any browser-stored credential is.
          You can revoke and regenerate it from your DeepL account at any time.
        </p>
      </section>
    </main>
  );
}
