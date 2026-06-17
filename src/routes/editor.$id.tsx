import { createFileRoute } from "@tanstack/react-router";
import { EditorShell } from "@/editor/EditorShell";

export const Route = createFileRoute("/editor/$id")({
  head: () => ({ meta: [{ title: "Editor — Web Game Builder" }] }),
  component: EditorPage,
});

function EditorPage() {
  const { id } = Route.useParams();
  return <EditorShell id={id} />;
}
