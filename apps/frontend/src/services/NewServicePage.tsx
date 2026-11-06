import { useState, type FormEvent } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLoad } from "@/hooks/useLoad";
import { useRequest } from "@/hooks/useRequest";
import { useCrumbs } from "@/stores/crumbs";
import type { NewService } from "@/types";

const select =
  "border-input h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:gap-6">
      <div>
        <Label>{label}</Label>
        {hint && <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function NewServicePage({ organizationId }: { organizationId: string }) {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const github = useLoad(() => api.getGitHubStatus(organizationId), [organizationId]);
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("");
  const [env, setEnv] = useState<[string, string][]>([]);
  const create = useRequest((service: NewService) => api.createService(projectId, service), {
    onSuccess: (service) => navigate(`/app/services/${service.id}`),
  });
  const repos = github.data?.connected ? github.data.repositories : [];
  const project = useLoad(() => api.getProject(projectId), [projectId]);
  useCrumbs(project.data ? [{ label: project.data.name, to: `/app/projects/${projectId}` }] : []);

  function pickRepository(fullName: string) {
    setRepository(fullName);
    setBranch(repos.find((r) => r.fullName === fullName)?.defaultBranch ?? "");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.send({
      name: String(form.get("name")).trim(),
      repository,
      branch: branch.trim(),
      sourceDirectory: String(form.get("sourceDirectory")).trim(),
      port: Number(form.get("port")),
      healthCheckPath: String(form.get("healthCheckPath")).trim(),
      envVars: Object.fromEntries(env.filter(([key]) => key.trim())),
    });
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link
          to={`/app/projects/${projectId}`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Back to project
        </Link>
        <h1 className="mt-1 text-3xl font-medium tracking-[-0.03em]">Add a web service</h1>
        <p className="text-muted-foreground mt-1">
          ForgeOps checks the repository, branch and Dockerfile with GitHub before saving.
        </p>
      </div>

      {github.data && !github.data.connected && (
        <p className="rounded-lg border px-5 py-4 text-sm">
          Connect GitHub on the{" "}
          <Link to="/app" className="underline underline-offset-4">
            projects page
          </Link>{" "}
          first.
        </p>
      )}

      <form onSubmit={submit} className="divide-y rounded-lg border">
        <div className="space-y-6 p-6">
          <Field label="Name" hint="Lowercase letters, numbers and dashes. Part of the URL.">
            <Input name="name" placeholder="api" className="h-9 font-mono" required />
          </Field>
          <Field label="Repository">
            <select
              className={select}
              value={repository}
              onChange={(e) => pickRepository(e.target.value)}
              required
            >
              <option value="" disabled>
                {github.data ? "Choose a repository" : "Loading repositories..."}
              </option>
              {repos.map((repo) => (
                <option key={repo.id} value={repo.fullName}>
                  {repo.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branch" hint="Every deploy builds the latest commit on this branch.">
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="h-9 font-mono"
              required
            />
          </Field>
          <Field
            label="Root directory"
            hint="The folder with your Dockerfile. Leave empty for the repository root."
          >
            <Input name="sourceDirectory" placeholder="api" className="h-9 font-mono" />
          </Field>
          <Field label="Port" hint="The port your app listens on.">
            <Input
              name="port"
              type="number"
              min={1}
              max={65535}
              placeholder="8080"
              className="h-9 max-w-32 font-mono"
              required
            />
          </Field>
          <Field
            label="Health check path"
            hint="We call this path on your app before sending it traffic. Leave empty to accept any response."
          >
            <Input name="healthCheckPath" defaultValue="/health/ready" className="h-9 font-mono" />
          </Field>
        </div>
        <div className="space-y-4 p-6">
          <Field
            label="Environment variables"
            hint="Encrypted when saved. Only names are shown afterwards."
          >
            <div className="space-y-2">
              {env.map(([key, value], index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={key}
                    onChange={(e) =>
                      setEnv(env.map((row, i) => (i === index ? [e.target.value, row[1]] : row)))
                    }
                    placeholder="NAME"
                    aria-label="Variable name"
                    className="h-9 font-mono"
                  />
                  <Input
                    value={value}
                    onChange={(e) =>
                      setEnv(env.map((row, i) => (i === index ? [row[0], e.target.value] : row)))
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
                    aria-label="Remove variable"
                    onClick={() => setEnv(env.filter((_, i) => i !== index))}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 bg-transparent"
                onClick={() => setEnv([...env, ["", ""]])}
              >
                <Plus />
                Add variable
              </Button>
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4">
          {create.error && <p className="text-fail mr-auto text-sm">{create.error}</p>}
          <Button type="submit" className="h-9" disabled={create.isLoading}>
            {create.isLoading && <Loader2 className="animate-spin" />}
            {create.isLoading ? "Checking with GitHub..." : "Save service"}
          </Button>
        </div>
      </form>
    </div>
  );
}
