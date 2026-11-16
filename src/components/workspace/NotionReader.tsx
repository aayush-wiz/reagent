import { useEffect, useState } from "react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { Loader, Center } from "@mantine/core";

/**
 * Read-only Notion-style document viewer — the same BlockNote editor worklone
 * uses for its README. Parses Markdown → BlockNote blocks and renders them
 * with `editable={false}`.
 */
export default function NotionReader({ markdown }: { markdown: string }) {
  const editor = useCreateBlockNote();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    editor.tryParseMarkdownToBlocks(markdown).then((blocks) => {
      if (!alive) return;
      editor.replaceBlocks(editor.document, blocks);
      setReady(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

  if (!ready) {
    return (
      <Center py="xl">
        <Loader size="sm" color="terracotta" />
      </Center>
    );
  }
  return (
    <div className="paper-reader">
      <BlockNoteView editor={editor} editable={false} theme="light" />
    </div>
  );
}
