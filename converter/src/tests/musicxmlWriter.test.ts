import { describe, expect, it } from "vitest";
import { fmsToCommonProject } from "../mapper/common.js";
import { optimizeCommonProject } from "../optimizer/common.js";
import { readTextFms } from "../parser/fms/textReader.js";
import { writeMusicXmlFromCommon } from "../writer/musicxml/index.js";

describe("MusicXML writer", () => {
  it("writes a partwise MusicXML score from optimized common data", () => {
    const project = readTextFms(`Project Version="4.5.1" TempoMode="FamiStudio" Name="MusicXML Fixture" Author="Codex"
\tInstrument Name="Lead"
\tInstrument Name="Noise"
\tSong Name="Battle" Length="1" LoopPoint="0" PatternLength="16" BeatLength="4" NoteLength="4" Groove="4"
\t\tChannel Type="Square1"
\t\t\tPattern Name="Lead"
\t\t\t\tNote Time="0" Value="C4" Duration="4" Instrument="Lead" Volume="12"
\t\t\t\tNote Time="8" Value="D4" Duration="4" Instrument="Lead"
\t\t\tPatternInstance Time="0" Pattern="Lead"
\t\tChannel Type="Noise"
\t\t\tPattern Name="Noise"
\t\t\t\tNote Time="4" Value="C3" Duration="2" Instrument="Noise" Volume="8"
\t\t\tPatternInstance Time="0" Pattern="Noise"`);
    const common = optimizeCommonProject(fmsToCommonProject(project));
    const xml = writeMusicXmlFromCommon(common);

    expect(xml).toContain('<score-partwise version="3.1">');
    expect(xml).toContain("<work-title>Battle</work-title>");
    expect(xml).toContain("<part-name>GB Square1</part-name>");
    expect(xml).toContain("<part-name>GB Noise</part-name>");
    expect(xml).toContain("<step>C</step>");
    expect(xml).toContain("<octave>4</octave>");
    expect(xml).toContain("<duration>4</duration>");
    expect(xml).toContain("<unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched>");
  });
});
