import { applyAction, createRng } from "@gaffer/engine";
import type { Action, MatchSetup, MatchState } from "@gaffer/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useOrientation } from "../board/orientation";
import { Pitch } from "../board/Pitch";
import { Scoreboard } from "../board/Scoreboard";
import { NO_TARGETS, targetsFor } from "../board/targets";
import { SetupScreen } from "../setup/SetupScreen";
import { Wordmark } from "../ui/Wordmark";
import { GUIDE_CARRIER, guidePosition } from "./position";
import { markGuideSeen } from "./seen";
import { Spotlight } from "./Spotlight";
import { StepCard } from "./StepCard";
import { guideSteps } from "./steps";

export interface GuideProps {
  /** What the setup screen starts on. */
  initial: MatchSetup;
  /**
   * Called when the guide is done — with whatever setup was chosen along the
   * way, so it ends by dropping the player into a real match rather than back
   * where they started.
   */
  onFinish: (setup: MatchSetup) => void;
  /** Called when it is skipped. Nothing is started. */
  onSkip: () => void;
}

/**
 * The guided introduction: three steps on the real setup screen, four on a
 * practice position, and then a real match.
 *
 * Two rules shape all of it.
 *
 * **It teaches the real interface.** The setup steps are the *actual* setup
 * screen with a hole cut in a dimmed page over it, not a picture of one, and
 * the board steps are the real `Pitch` reading a real engine state. There is no
 * second copy of anything to fall out of step with the first.
 *
 * **It changes no rules.** The practice board is reached by replaying legal
 * commands through `applyAction` like everything else, the moves the player
 * makes go through `applyAction` too, and the guide's only power is over what
 * it *says* and what it *advances on*. The engine cannot tell it is being used
 * for a tutorial.
 *
 * Where it waits for the player, it waits on things that cannot fail: choosing
 * a player, and an uncontested pass. A step that waited on a contested action
 * would teach "and then you lose the ball" six times in ten.
 */
export function Guide({ initial, onFinish, onSkip }: GuideProps) {
  const orientation = useOrientation();

  /* The practice position, built once. Replaying it is cheap, but rebuilding it
     per render would throw away any move the player has made on it. */
  const [board, setBoard] = useState<MatchState>(() => guidePosition().state);
  const [rng] = useState(() => createRng(1));

  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<MatchSetup>(initial);
  const [picked, setPicked] = useState<string | null>(null);
  const [cardTop, setCardTop] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerHeight,
  );

  const steps = useMemo(() => guideSteps(board), [board]);
  const step = steps[index]!;
  const last = index === steps.length - 1;

  /*
   * Who the board draws as selected — derived from the step rather than stored
   * alongside it. Most steps show the board as it would look with somebody
   * already chosen, because the point of those steps is what the selection
   * *reveals* rather than the act of selecting; only the step that asks for a
   * tap cares what was actually tapped. Presentation only: it moves no ball.
   */
  const selectedId =
    step.id === "targets" || step.id === "commit"
      ? GUIDE_CARRIER
      : step.id === "score"
        ? board.ball.carrierId
        : step.id === "select"
          ? picked
          : null;

  const leave = useCallback(() => {
    markGuideSeen();
    onSkip();
  }, [onSkip]);

  const finish = useCallback(() => {
    markGuideSeen();
    onFinish(chosen);
  }, [chosen, onFinish]);

  const advance = useCallback(() => {
    setIndex((current) => Math.min(current + 1, steps.length - 1));
  }, [steps.length]);

  /* Escape leaves from anywhere, which is the one keyboard promise a thing
     covering the whole screen has to keep. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") leave();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leave]);

  /** Pressing "Kick off" during the guide moves it on instead of starting a match. */
  const kickOff = (setup: MatchSetup) => {
    setChosen(setup);
    if (step.expect.kind === "kickoff") advance();
  };

  const select = (playerId: string | null) => {
    setPicked(playerId);
    if (step.expect.kind === "select" && playerId === step.expect.playerId) advance();
  };

  const commit = (action: Action) => {
    if (step.expect.kind !== "commit" || !step.expect.matches(action)) {
      /* Anything else is simply not taken. The board keeps its shape, the step
         keeps asking, and there is no way to wander into a position the next
         step cannot describe. */
      return;
    }

    const result = applyAction(board, action, rng);
    if (!result.ok) return;

    setBoard(result.state);
    advance();
  };

  const waiting = step.expect.kind !== "none";
  const targets = step.phase === "board" ? targetsFor(board, selectedId) : NO_TARGETS;

  return (
    <>
      {step.phase === "setup" ? (
        <SetupScreen initial={chosen} onStart={kickOff} />
      ) : (
        <main className="min-h-dvh bg-(--color-night) bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-night-soft),var(--color-night))] px-4 py-6 text-white">
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            <header>
              <h1 className="text-2xl leading-none">
                <Wordmark />
              </h1>
              <p className="mt-1 text-xs text-white/55">
                A practice position &mdash; nothing here counts.
              </p>
            </header>

            <Scoreboard state={board} />

            <Pitch
              state={board}
              seat="home"
              selectedId={selectedId}
              targets={targets}
              onSelect={select}
              onCommit={commit}
              onFocusTarget={() => {}}
              orientation={orientation}
            />
          </div>
        </main>
      )}

      {/*
        Room at the foot of the page for the card to sit over.

        Without it the last controls on a screen cannot be scrolled clear of a
        card pinned to the bottom — there is simply no document left to scroll —
        and "Kick off", the one button a step asks to be pressed, ends up
        underneath the step asking for it.
      */}
      <div aria-hidden className="h-80" />

      <Spotlight anchors={step.anchors} cardTop={cardTop} generation={index} />

      <StepCard
        chapter={step.chapter}
        index={index}
        total={steps.length}
        title={step.title}
        body={step.body(board)}
        prompt={waiting ? step.prompt?.(board) : undefined}
        onBack={index > 0 ? () => setIndex(index - 1) : undefined}
        onNext={waiting ? undefined : last ? finish : advance}
        nextLabel={last ? "Play for real" : "Next"}
        onSkip={leave}
        onMeasure={setCardTop}
      />
    </>
  );
}
