import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyComposerFile,
  documentTypeLabel,
  isTextDocument,
} from "./composer-attachments";

describe("composer-attachments", () => {
  it("classifies images and documents", () => {
    assert.equal(
      classifyComposerFile(
        new File([""], "photo.png", { type: "image/png" }),
      ),
      "image",
    );
    assert.equal(
      classifyComposerFile(
        new File(["hello"], "notes.md", { type: "text/markdown" }),
      ),
      "document",
    );
    assert.equal(
      classifyComposerFile(
        new File([""], "report.pdf", { type: "application/pdf" }),
      ),
      "document",
    );
    assert.equal(
      classifyComposerFile(
        new File([""], "bin.exe", { type: "application/octet-stream" }),
      ),
      null,
    );
  });

  it("detects text documents and labels", () => {
    assert.equal(
      isTextDocument({ name: "a.md", mimeType: "text/markdown" }),
      true,
    );
    assert.equal(documentTypeLabel({ name: "a.pdf" }), "PDF");
    assert.equal(documentTypeLabel({ name: "notes.MD" }), "MD");
  });
});
