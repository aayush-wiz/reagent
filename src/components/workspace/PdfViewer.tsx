/**
 * PdfViewer — renders the actual paper PDF (figures, tables, layout, ditto),
 * ported from answerThis (frontend/src/components/PdfViewer.tsx). Uses
 * @cyntler/react-doc-viewer's DocViewer + PDFRenderer (pdf.js under the hood).
 * The `uri` is our same-origin proxy (/api/papers/:id/pdf) so there's no CORS.
 *
 * Layout matches answerThis: a scrollable grey surface with the pages centered
 * at a max width (`max-w-4xl mx-auto`) so the PDF fits the view and doesn't
 * overflow to the right.
 */
import DocViewer, { PDFRenderer } from "@cyntler/react-doc-viewer";

export default function PdfViewer({ uri }: { uri: string }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#f3f4f6", padding: "16px" }}>
      <div style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
        <DocViewer
          documents={[{ uri, fileType: "pdf" }]}
          activeDocument={{ uri, fileType: "pdf" }}
          config={{
            header: { disableHeader: true, disableFileName: true, retainURLParams: false },
            pdfZoom: { defaultZoom: 1, zoomJump: 0.2 },
            pdfVerticalScrollByDefault: true,
          }}
          pluginRenderers={[PDFRenderer]}
          style={{ width: "100%", background: "transparent" }}
        />
      </div>
    </div>
  );
}
