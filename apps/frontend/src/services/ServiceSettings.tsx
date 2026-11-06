import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Loader2, Plus, Undo2, X } from "lucide-react";
import { api } from "@/api";
import { DeleteSection } from "@/components/DeleteSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequest } from "@/hooks/useRequest";
import { cn } from "@/lib/utils";
import type { Service } from "@/types";

function Section({
  title,
  text,
  children,
  footer,
}: {
  title: string;
  text: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="bg-card overflow-hidden rounded-lg border">
      <div className="space-y-5 p-6">
        <div>
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{text}</p>
        </div>
        {children}
      </div>
      <div className="bg-muted/50 flex flex-wrap items-center justify-end gap-3 border-t px-6 py-3">
        {footer}
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 sm:grid-cols-[13rem_1fr] sm:gap-6">
      <span>
        <span className="text-sm font-medium">{label}</span>
        <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">{hint}</span>
      </span>
      {children}
    </label>
  );
}

function Saved({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="text-ok mr-auto flex items-center gap-1.5 text-sm">
      <Check className="size-4" />
      Saved. Deploy to apply the change.
    </span>
  );
}

export function ServiceSettings({ service, onSaved }: { service: Service; onSaved: () => void }) {
  const [branch, setBranch] = useState(service.branch);
  const [root, setRoot] = useState(service.sourceDirectory);
  const [port, setPort] = useState(String(service.port));
  const [healthPath, setHealthPath] = useState(service.healthCheckPath);
  const [removed, setRemoved] = useState<string[]>([]);
  const [added, setAdded] = useState<[string, string][]>([]);
  const [savedBuild, setSavedBuild] = useState(false);
  const [savedEnv, setSavedEnv] = useState(false);

  const saveBuild = useRequest(
    () =>
      api.updateService(service.id, {
        branch: branch.trim(),
        sourceDirectory: root.trim(),
        port: Number(port),
        healthCheckPath: healthPath.trim(),
      }),
    {
      onSuccess: () => {
        setSavedBuild(true);
        onSaved();
      },
    },
  );
  const saveEnv = useRequest(
    () =>
      api.updateService(service.id, {
        envVars: {
          ...Object.fromEntries(removed.map((name) => [name, null])),
          ...Object.fromEntries(
            added.filter(([name]) => name.trim()).map(([n, v]) => [n.trim(), v]),
          ),
        },
      }),
    {
      onSuccess: () => {
        setRemoved([]);
        setAdded([]);
        setSavedEnv(true);
        onSaved();
      },
    },
  );

  const buildChanged =
    branch.trim() !== service.branch ||
    root.trim() !== service.sourceDirectory ||
    Number(port) !== service.port ||
    healthPath.trim() !== service.healthCheckPath;
  const envChanged = removed.length > 0 || added.some(([name]) => name.trim());

  function submitBuild(event: FormEvent) {
    event.preventDefault();
    setSavedBuild(false);
    saveBuild.send();
  }

  function submitEnv(event: FormEvent) {
    event.preventDefault();
    setSavedEnv(false);
    saveEnv.send();
  }

  return (
    <div className="max-w-4xl space-y-8">
      <form onSubmit={submitBuild}>
        <Section
          title="Build and run"
          text={`Where ForgeOps finds your code in ${service.repository}, and how your app is reached.`}
          footer={
            <>
              <Saved show={savedBuild && !buildChanged} />
              {saveBuild.error && <p className="text-fail mr-auto text-sm">{saveBuild.error}</p>}
              <Button type="submit" className="h-9" disabled={!buildChanged || saveBuild.isLoading}>
                {saveBuild.isLoading && <Loader2 className="animate-spin" />}
                {saveBuild.isLoading ? "Checking with GitHub..." : "Save"}
              </Button>
            </>
          }
        >
          <Field label="Branch" hint="Every deploy builds the latest commit on this branch.">
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="h-9 font-mono"
              required
            />
          </Field>
          <Field
            label="Root directory"
            hint="The folder with your Dockerfile. Leave empty for the repository root."
          >
            <Input
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              placeholder="api"
              className="h-9 font-mono"
            />
          </Field>
          <Field label="Port" hint="The port your app listens on.">
            <Input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="h-9 max-w-32 font-mono"
              required
            />
          </Field>
          <Field
            label="Health check path"
            hint="We call this path on your app before sending it traffic. Leave empty to accept any response."
          >
            <Input
              value={healthPath}
              onChange={(e) => setHealthPath(e.target.value)}
              placeholder="/health/ready"
              className="h-9 font-mono"
            />
          </Field>
        </Section>
      </form>

      <form onSubmit={submitEnv}>
        <Section
          title="Environment variables"
          text="Encrypted when saved and only shown by name. To change a value, add it again with the same name."
          footer={
            <>
              <Saved show={savedEnv && !envChanged} />
              {saveEnv.error && <p className="text-fail mr-auto text-sm">{saveEnv.error}</p>}
              <Button type="submit" className="h-9" disabled={!envChanged || saveEnv.isLoading}>
                {saveEnv.isLoading && <Loader2 className="animate-spin" />}
                Save
              </Button>
            </>
          }
        >
          {service.envVarNames.length === 0 && added.length === 0 && (
            <p className="text-muted-foreground text-sm">No variables yet.</p>
          )}
          <ul className="divide-y rounded-md border empty:hidden">
            {service.envVarNames.map((name) => {
              const gone = removed.includes(name);
              return (
                <li key={name} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span
                    className={cn(
                      "font-mono text-sm",
                      gone && "text-muted-foreground line-through",
                    )}
                  >
                    {name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-7"
                    onClick={() =>
                      setRemoved(gone ? removed.filter((n) => n !== name) : [...removed, name])
                    }
                  >
                    {gone ? <Undo2 /> : <X />}
                    {gone ? "Keep" : "Remove"}
                  </Button>
                </li>
              );
            })}
          </ul>
          {added.map(([name, value], index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={name}
                onChange={(e) =>
                  setAdded(added.map((row, i) => (i === index ? [e.target.value, row[1]] : row)))
                }
                placeholder="NAME"
                aria-label="Variable name"
                className="h-9 font-mono"
              />
              <Input
                value={value}
                onChange={(e) =>
                  setAdded(added.map((row, i) => (i === index ? [row[0], e.target.value] : row)))
                }
                placeholder="value"
                aria-label="Variable value"
                type="password"
                className="h-9 font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="Remove row"
                onClick={() => setAdded(added.filter((_, i) => i !== index))}
              >
                <X />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setAdded([...added, ["", ""]])}
          >
            <Plus />
            Add variable
          </Button>
        </Section>
      </form>

      <DeleteSection
        what="service"
        name={service.name}
        text="Takes the app offline, frees its URL and removes its deploy history. This cannot be undone."
        remove={() => api.deleteService(service.id)}
        then={`/app/projects/${service.projectId}`}
      />
    </div>
  );
}
