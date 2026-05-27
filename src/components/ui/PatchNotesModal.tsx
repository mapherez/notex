import { Fragment, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import patchNotesMarkdown from "../../content/patch-notes.md?raw";
import {
  parseMarkdown,
  type MarkdownBlock,
  type MarkdownListItem,
} from "../../core/utils/markdown";
import { useI18n } from "../../i18n/I18nProvider";
import { renderInlineText } from "../editing/InlineFormattedText";

type PatchNoteVersion = {
  blockIndex: number;
  id: string;
  title: string;
};

type PatchNotesModel = {
  blocks: MarkdownBlock[];
  headingIds: Map<number, string>;
  versions: PatchNoteVersion[];
};

const patchNotesModel = buildPatchNotesModel(patchNotesMarkdown);
export const latestPatchNoteVersion = patchNotesModel.versions[0]?.title ?? "";

export function PatchNotesModal({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const headingRefs = useRef<Record<string, HTMLHeadingElement | null>>({});
  const { blocks, headingIds, versions } = patchNotesModel;
  const [activeId, setActiveId] = useState<string | null>(
    versions[0]?.id ?? null,
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setActiveId(versions[0]?.id ?? null);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, versions]);

  if (!open) {
    return null;
  }

  function scrollToVersion(versionId: string) {
    setActiveId(versionId);
    headingRefs.current[versionId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function registerHeading(id: string, element: HTMLHeadingElement | null) {
    headingRefs.current[id] = element;
  }

  return (
    <div className="modal-backdrop">
      <section
        className="choice-modal patch-notes-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-notes-title"
      >
        <header className="patch-notes-modal__header">
          <h2 id="patch-notes-title">{t("patchNotes.title")}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <X />
          </button>
        </header>

        <div className="patch-notes-modal__layout">
          <nav
            className="patch-notes-modal__versions"
            aria-label={t("patchNotes.versions")}
          >
            <h3>{t("patchNotes.versions")}</h3>
            <div>
              {versions.map((version) => (
                <button
                  className={version.id === activeId ? "active" : undefined}
                  key={version.id}
                  type="button"
                  onClick={() => scrollToVersion(version.id)}
                >
                  {version.title}
                </button>
              ))}
            </div>
          </nav>

          <div className="patch-notes-modal__content">
            {blocks.length ? (
              <div className="markdown-preview">
                {blocks.map((block, index) =>
                  renderPatchNotesBlock(
                    block,
                    index,
                    headingIds,
                    registerHeading,
                  ),
                )}
              </div>
            ) : (
              <p className="markdown-empty">{t("patchNotes.empty")}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function buildPatchNotesModel(markdown: string): PatchNotesModel {
  const blocks = parseMarkdown(markdown);
  const usedIds = new Map<string, number>();
  const versions = blocks.flatMap((block, blockIndex) => {
    if (block.type !== "heading" || block.level !== 1) {
      return [];
    }

    return [
      {
        blockIndex,
        id: uniqueHeadingId(block.text, usedIds),
        title: block.text,
      },
    ];
  });
  const headingIds = new Map(
    versions.map((version) => [version.blockIndex, version.id]),
  );

  return { blocks, headingIds, versions };
}

function renderPatchNotesBlock(
  block: MarkdownBlock,
  index: number,
  headingIds: Map<number, string>,
  registerHeading: (id: string, element: HTMLHeadingElement | null) => void,
) {
  if (block.type === "heading") {
    return (
      <PatchNotesHeading
        id={headingIds.get(index)}
        key={index}
        level={block.level}
        onRegister={registerHeading}
        text={block.text}
      />
    );
  }

  if (block.type === "horizontal-rule") {
    return <hr key={index} />;
  }

  if (block.type === "paragraph") {
    return <p key={index}>{renderParagraphLines(block.lines)}</p>;
  }

  if (block.type === "unordered-list") {
    return (
      <ul key={index}>
        {block.items.map((item, itemIndex) => (
          <li key={`${index}-${itemIndex}`}>{renderListItem(item)}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "ordered-list") {
    return (
      <ol key={index}>
        {block.items.map((item, itemIndex) => (
          <li key={`${index}-${itemIndex}`}>{renderListItem(item)}</li>
        ))}
      </ol>
    );
  }

  if (block.type === "blockquote") {
    return (
      <blockquote key={index}>
        {block.lines.map((line, lineIndex) => (
          <p key={`${index}-${lineIndex}`}>{renderInlineText(line)}</p>
        ))}
      </blockquote>
    );
  }

  if (block.type === "code") {
    return (
      <pre key={index}>
        <code>{block.code}</code>
      </pre>
    );
  }

  return null;
}

function PatchNotesHeading({
  id,
  level,
  onRegister,
  text,
}: {
  id?: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  onRegister: (id: string, element: HTMLHeadingElement | null) => void;
  text: string;
}) {
  const headingProps = id
    ? {
        id,
        ref: (element: HTMLHeadingElement | null) => onRegister(id, element),
      }
    : {};

  if (level === 1) {
    return <h1 {...headingProps}>{renderInlineText(text)}</h1>;
  }
  if (level === 2) {
    return <h2 {...headingProps}>{renderInlineText(text)}</h2>;
  }
  if (level === 3) {
    return <h3 {...headingProps}>{renderInlineText(text)}</h3>;
  }
  if (level === 4) {
    return <h4 {...headingProps}>{renderInlineText(text)}</h4>;
  }
  if (level === 5) {
    return <h5 {...headingProps}>{renderInlineText(text)}</h5>;
  }
  return <h6 {...headingProps}>{renderInlineText(text)}</h6>;
}

function renderParagraphLines(lines: string[]) {
  return lines.map((line, lineIndex) => (
    <Fragment key={lineIndex}>
      {lineIndex > 0 ? <br /> : null}
      {renderInlineText(line)}
    </Fragment>
  ));
}

function renderListItem(item: MarkdownListItem) {
  return renderInlineText(item.text);
}

function uniqueHeadingId(text: string, usedIds: Map<string, number>) {
  const baseId = `patch-notes-${slugifyHeading(text)}`;
  const useCount = usedIds.get(baseId) ?? 0;
  usedIds.set(baseId, useCount + 1);

  return useCount ? `${baseId}-${useCount + 1}` : baseId;
}

function slugifyHeading(text: string) {
  return (
    text
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "version"
  );
}
