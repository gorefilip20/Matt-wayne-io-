import { Callout } from "./Callout";
import { Checklist } from "./Checklist";
import { CodeBlock } from "./CodeBlock";
import { Step } from "./Step";
import { TableOfContents } from "./TableOfContents";

export const guideSections = [
  { id: "step-1", label: "Define the market structure" },
  { id: "step-2", label: "Mark your key levels" },
  { id: "step-3", label: "Wait for a confirmation trigger" },
  { id: "step-4", label: "Size the position from risk, not hope" },
  { id: "step-5", label: "Manage the trade and journal it" },
];

const positionSizeCode = `// Risk a fixed % of the account on every trade
const accountBalance = 10_000;   // $
const riskPercent    = 1;        // % of account per trade
const entryPrice     = 1.0850;
const stopLoss       = 1.0820;

const riskAmount   = accountBalance * (riskPercent / 100);  // $100
const stopDistance = Math.abs(entryPrice - stopLoss);        // 0.0030
const positionSize = riskAmount / stopDistance;              // 33,333 units

console.log({ riskAmount, stopDistance, positionSize });`;

const journalCode = `date:        2026-10-14
setup:       Bullish break & retest of 1.0820
trend (HTF): Higher highs + higher lows on 4H
trigger:     Bullish engulfing on 15m at level
entry:       1.0850   stop: 1.0820   target: 1.0940
R multiple:  +3.0R
followed plan?  yes
lesson:      Waited for the close instead of front-running it.`;

export function GuideContent() {
  return (
    <article id="guide" className="pt-6">
      <TableOfContents items={guideSections} />

      <div className="guide-prose mt-10">
        <p>
          Here&apos;s the uncomfortable truth: most traders don&apos;t have a strategy problem, they have a{" "}
          <strong>consistency problem</strong>. They take a great setup on Monday, a revenge trade on Tuesday and a
          &quot;feels right&quot; trade on Wednesday. The results look random because the process is random.
        </p>
        <p>
          The framework below fixes that. It&apos;s five steps you run in the same order before every single trade.
          No indicators to buy, no signals group. Just a repeatable checklist that keeps you out of bad trades and
          sizes the good ones correctly.
        </p>
      </div>

      <Step number={1} id="step-1" title="Define the market structure first">
        <p>
          Before you look for an entry, answer one question: <strong>which way is price actually moving?</strong> Open
          a higher timeframe (4H or Daily) and label the swing points.
        </p>
        <ul className="bullets">
          <li>
            <strong>Uptrend:</strong> higher highs (HH) and higher lows (HL).
          </li>
          <li>
            <strong>Downtrend:</strong> lower highs (LH) and lower lows (LL).
          </li>
          <li>
            <strong>Range:</strong> price bouncing between a clear ceiling and floor.
          </li>
        </ul>
        <p>
          You only take trades in the direction of the higher-timeframe structure. That one rule removes roughly half
          the losing trades most beginners take.
        </p>
        <Callout variant="tip">
          If you can&apos;t label the structure in under 30 seconds, the market is messy. <strong>No clear trend means
          no trade.</strong> Sitting out is a position.
        </Callout>
      </Step>

      <Step number={2} id="step-2" title="Mark your key levels">
        <p>
          Levels are where decisions happen. Draw no more than <strong>three to four</strong> horizontal zones per
          chart, otherwise everything becomes a level and nothing is.
        </p>
        <ol className="numbers">
          <li>Previous day / week highs and lows.</li>
          <li>Swing points where price reversed sharply at least twice.</li>
          <li>Old support that broke and may now act as resistance (and vice versa).</li>
        </ol>
        <Callout variant="info" title="Zones, not lines">
          Price rarely respects an exact number. Draw levels as a zone covering the candle wicks, then wait for price
          to react inside it.
        </Callout>
      </Step>

      <Step number={3} id="step-3" title="Wait for a confirmation trigger">
        <p>
          Price touching your level is <strong>not</strong> an entry. It&apos;s an alert. Drop to a lower timeframe
          (15m or 1H) and wait for the market to show its hand with one of these triggers:
        </p>
        <Checklist
          title="Valid entry triggers"
          items={[
            <>
              <strong className="text-white">Engulfing candle</strong> closing back in your trend direction.
            </>,
            <>
              <strong className="text-white">Break &amp; retest</strong>: level breaks, price returns, holds and
              rejects.
            </>,
            <>
              <strong className="text-white">Pin bar / rejection wick</strong> at least 2× the size of the body.
            </>,
            <>
              <strong className="text-white">Lower-timeframe structure shift</strong> (first HL in an uptrend setup).
            </>,
          ]}
        />
        <Callout variant="warning">
          Never enter before the trigger candle <strong>closes</strong>. A wick that looks like a rejection at minute 10
          can become a full breakdown by minute 15.
        </Callout>
      </Step>

      <Step number={4} id="step-4" title="Size the position from risk, not hope">
        <p>
          This is the step that separates traders who survive from traders who blow up. Decide how much you&apos;re
          willing to lose <strong>before</strong> you decide how much to buy. Professionals typically risk 0.5% to 2%
          of the account per trade.
        </p>
        <p>
          Your stop goes where the trade idea is proven wrong (just beyond the level or the trigger candle), and your
          position size is calculated from that distance:
        </p>
        <CodeBlock code={positionSizeCode} filename="position-size.js" />
        <p>
          Notice what this does: a wide stop automatically means a smaller position, a tight stop a bigger one. Your
          dollar risk stays the same on every trade, so <strong>one loss can never wreck your account.</strong>
        </p>
        <Callout variant="tip" title="The 2R minimum">
          Only take trades where the target is at least <code>2×</code> your risk. At 2R you can be wrong 6 times out of
          10 and still be profitable.
        </Callout>
      </Step>

      <Step number={5} id="step-5" title="Manage the trade and journal it">
        <p>Once you&apos;re in, your job is to do as little as possible. Set it up so emotions can&apos;t interfere:</p>
        <ul className="bullets">
          <li>Place the stop and target as real orders the moment you enter.</li>
          <li>
            Move the stop to breakeven only after price reaches <strong>1R</strong> in profit.
          </li>
          <li>Never widen a stop. Ever.</li>
        </ul>
        <p>
          Then log every trade, win or lose. After 30 trades your journal tells you exactly which setups make money and
          which ones to drop. Here&apos;s the template:
        </p>
        <CodeBlock code={journalCode} filename="trade-journal.txt" />
      </Step>

      <section aria-labelledby="pretrade-title" className="mt-14">
        <h2 id="pretrade-title" className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
          Your pre-trade checklist
        </h2>
        <p className="guide-prose mt-4">Run through this every time. If a single box is unchecked, skip the trade.</p>
        <div className="mt-5">
          <Checklist
            items={[
              "Higher-timeframe structure is clear and I'm trading with it",
              "Price is reacting inside one of my marked zones",
              "A lower-timeframe trigger candle has closed",
              "Stop is placed where the idea is invalidated",
              "Position size risks 1% (or less) of my account",
              "Target is at least 2R away with no major level in between",
            ]}
          />
        </div>
      </section>
    </article>
  );
}
