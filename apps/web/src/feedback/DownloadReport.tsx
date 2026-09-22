import type { MatchSetup, MatchState } from "@gaffer/shared";

import type { RecordedEvent } from "../match/useMatch";
import { Button } from "../ui/Button";
import type { FeedbackNote } from "./notes";
import { downloadFile, pageOrigin } from "./download";
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
  const download = () =>
    downloadFile(
      reportFilename(setup),
      buildReport({ setup, state, log, notes, origin: pageOrigin() }),
      "text/markdown;charset=utf-8",
    );

  return (
    <Button tone={tone} onClick={download}>
      Download feedback
      {notes.length > 0 && ` (${notes.length})`}
    </Button>
  );
}
