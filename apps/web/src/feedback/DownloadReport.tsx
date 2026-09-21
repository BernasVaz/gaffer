import type { MatchSetup, MatchState } from "@gaffer/shared";

import type { RecordedEvent } from "../match/useMatch";
import { Button } from "../ui/Button";
import type { FeedbackNote } from "./notes";
import { buildReport, reportFilename } from "./report";

export interface DownloadReportProps {
  /** The match being reported on. */
  setup: MatchSetup;
  /** The board as it finished. */
  state: MatchState;
  /** Everything played. */
  log: readonly RecordedEvent[];
  /** The flagged moments. */
  notes: readonly FeedbackNote[];
  /** How loud the button should be. */
  tone?: "primary" | "quiet";
}

/**
 * Hand the whole match over as one file.
 *
 * A download rather than a copy-to-clipboard or a POST somewhere: there is no
 * server to send it to, the file is the deliverable, and a file can be read,
 * edited and forwarded by the person who made it before anyone else sees it.
 * Nothing about a match leaves the machine unless somebody chooses to send it.
 */
export function DownloadReport({ setup, state, log, notes, tone = "quiet" }: DownloadReportProps) {
  const download = () => {
    const origin =
      typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}`;

    const markdown = buildReport({ setup, state, log, notes, origin });
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = reportFilename(setup);
    document.body.append(link);
    link.click();
    link.remove();

    /* The object URL pins the blob in memory until it is let go. */
    URL.revokeObjectURL(url);
  };

  return (
    <Button tone={tone} onClick={download}>
      Download feedback
      {notes.length > 0 && ` (${notes.length})`}
    </Button>
  );
}
