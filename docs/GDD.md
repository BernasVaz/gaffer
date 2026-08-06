# Gaffer — Game Design Document

> **Status: stub.** This document is written in **M1**, before any game code exists.
> Nothing in `@gaffer/engine` should be implemented until the relevant section here
> is filled in.

The GDD is the **source of truth for the rules of the game**. The engine is built and
tested against it. When the engine and this document disagree, one of them is a bug —
decide which, fix it, and note the change.

## 1. The pitch

_One paragraph: what Gaffer is, and why someone would want to play it._

## 2. Pieces and stats

_What is on the board, what attributes each piece has, and what those attributes do._

## 3. How a turn works

_Turn order, phases within a turn, what a player may do and how many times._

## 4. Action resolution (the dice math)

_For each action — move, pass, dribble, shoot, press, tackle — the exact inputs, the
roll, the modifiers, and the outcome table. This section must be precise enough that
two people implementing it independently produce identical behaviour._

## 5. Discipline

_Fouls, cards, and their consequences._

## 6. Win and loss conditions

_How a match ends and how the winner is determined, including ties._

## 7. Match length

_Halves, turns per half, stoppage._

## 8. Scope of v1

**In scope:**

_The complete list of what v1 ships with._

**Explicitly out of scope:**

_What we are deliberately not building yet. This list is as important as the one
above — it is what stops v1 from expanding forever._

---

**M1 exit gate:** this document is complete enough that someone could implement the
rules from it with no further questions.
