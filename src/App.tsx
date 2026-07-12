import { useEffect, useMemo, useState } from "react";
import { DISTRICTS } from "./data/districts";
import { RULESETS } from "./data/rulesets";
import { computeDiscounts } from "./lib/discount";
import { useLocalStorageState } from "./lib/useLocalStorageState";
import "./App.css";

const VANILLA = RULESETS.find((r) => r.id === "vanilla")!;
const BBG = RULESETS.find((r) => r.id === "bbg")!;

interface BuildingInstance {
  uid: string;
  districtId: string;
  /** Discount status locked in at the moment this district was placed. */
  discounted: boolean;
  discountRate: number;
}

type DragPayload =
  | { source: "available"; districtId: string }
  | { source: "building"; uid: string; districtId: string }
  | { source: "finished"; districtId: string };

const DRAG_MIME = "application/json";

const SORTED_DISTRICTS = [...DISTRICTS].sort((a, b) => a.name.localeCompare(b.name));

function App() {
  const [useBbg, setUseBbg] = useLocalStorageState("civ6-discount:use-bbg", false);
  const [unlocked, setUnlocked] = useLocalStorageState<Record<string, boolean>>(
    "civ6-discount:unlocked",
    {},
  );
  const [buildingList, setBuildingList] = useLocalStorageState<BuildingInstance[]>(
    "civ6-discount:building",
    [],
  );
  const [finishedCounts, setFinishedCounts] = useLocalStorageState<Record<string, number>>(
    "civ6-discount:finished",
    {},
  );
  const [dragOverColumn, setDragOverColumn] = useState<"available" | "building" | "finished" | null>(
    null,
  );
  const [hoveredDistrictId, setHoveredDistrictId] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; districtId: string } | null>(
    null,
  );

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // Defer attaching outside-close listeners to the next tick so the same
    // right-click gesture that opened the menu doesn't immediately close it.
    const timer = window.setTimeout(() => {
      window.addEventListener("click", close);
      window.addEventListener("contextmenu", close);
      window.addEventListener("blur", close);
    }, 0);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("blur", close);
    };
  }, [contextMenu]);

  const ruleset = useBbg ? BBG : VANILLA;

  const buildingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of buildingList) counts[b.districtId] = (counts[b.districtId] ?? 0) + 1;
    return counts;
  }, [buildingList]);

  const summary = useMemo(
    () => computeDiscounts(DISTRICTS, unlocked, finishedCounts, buildingCounts, ruleset),
    [unlocked, finishedCounts, buildingCounts, ruleset],
  );
  const resultById = useMemo(() => {
    const map = new Map<string, (typeof summary.results)[number]>();
    for (const r of summary.results) map.set(r.id, r);
    return map;
  }, [summary]);

  const focusedDistrictId = hoveredDistrictId ?? selectedDistrictId;
  const hoveredResult = focusedDistrictId ? resultById.get(focusedDistrictId) : undefined;
  const focusedDistrict = focusedDistrictId
    ? DISTRICTS.find((d) => d.id === focusedDistrictId)
    : undefined;
  const hasHoverData = !!hoveredResult && summary.districtTypesUnlocked > 0;
  // C(T) < B/A, compared via cross-multiplication to avoid float rounding.
  const hoverBelowAverage =
    hasHoverData &&
    hoveredResult!.placedCount * summary.districtTypesUnlocked < summary.totalCompleted;

  function unlockDistrict(id: string) {
    setUnlocked((prev) => ({ ...prev, [id]: true }));
  }

  function lockDistrict(id: string) {
    setUnlocked((prev) => ({ ...prev, [id]: false }));
  }

  function canPlaceMore(districtId: string): boolean {
    const d = DISTRICTS.find((x) => x.id === districtId);
    if (!d?.singleBuild) return true;
    const already = (buildingCounts[districtId] ?? 0) + (finishedCounts[districtId] ?? 0);
    return already < 1;
  }

  function addBuildingInstance(districtId: string) {
    if (!canPlaceMore(districtId)) return;
    const r = resultById.get(districtId);
    setBuildingList((prev) => [
      ...prev,
      {
        uid: crypto.randomUUID(),
        districtId,
        discounted: r?.discounted ?? false,
        discountRate: r?.discountRate ?? 0,
      },
    ]);
  }

  function removeBuildingInstance(uid: string) {
    setBuildingList((prev) => prev.filter((b) => b.uid !== uid));
  }

  function finishDistrict(districtId: string) {
    setFinishedCounts((prev) => ({ ...prev, [districtId]: (prev[districtId] ?? 0) + 1 }));
  }

  function unfinishDistrict(districtId: string) {
    setFinishedCounts((prev) => {
      const current = prev[districtId] ?? 0;
      if (current <= 0) return prev;
      return { ...prev, [districtId]: current - 1 };
    });
  }

  function moveFinishedToBuilding(districtId: string) {
    const current = finishedCounts[districtId] ?? 0;
    if (current <= 0) return;
    unfinishDistrict(districtId);
    const r = resultById.get(districtId);
    setBuildingList((prev) => [
      ...prev,
      {
        uid: crypto.randomUUID(),
        districtId,
        discounted: r?.discounted ?? false,
        discountRate: r?.discountRate ?? 0,
      },
    ]);
  }

  function resetAll() {
    setUnlocked({});
    setBuildingList([]);
    setFinishedCounts({});
  }

  function handleDropOnAvailable(e: React.DragEvent) {
    e.preventDefault();
    setDragOverColumn(null);
    const payload = readPayload(e);
    if (!payload) return;
    if (payload.source === "building") {
      removeBuildingInstance(payload.uid);
    } else if (payload.source === "finished") {
      unfinishDistrict(payload.districtId);
    }
  }

  function handleDropOnBuilding(e: React.DragEvent) {
    e.preventDefault();
    setDragOverColumn(null);
    const payload = readPayload(e);
    if (!payload) return;
    if (payload.source === "available") {
      addBuildingInstance(payload.districtId);
    } else if (payload.source === "finished") {
      moveFinishedToBuilding(payload.districtId);
    }
  }

  function completeBuildingInstance(uid: string, districtId: string) {
    removeBuildingInstance(uid);
    finishDistrict(districtId);
  }

  function handleDropOnFinished(e: React.DragEvent) {
    e.preventDefault();
    setDragOverColumn(null);
    const payload = readPayload(e);
    if (!payload) return;
    if (payload.source === "available") {
      if (!canPlaceMore(payload.districtId)) return;
      finishDistrict(payload.districtId);
    } else if (payload.source === "building") {
      completeBuildingInstance(payload.uid, payload.districtId);
    }
  }

  const finishedGroups = SORTED_DISTRICTS.map((d) => ({
    district: d,
    count: finishedCounts[d.id] ?? 0,
  })).filter((g) => g.count > 0);

  const sortedBuildingList = useMemo(
    () =>
      [...buildingList].sort((a, b) => {
        const nameA = DISTRICTS.find((d) => d.id === a.districtId)?.name ?? "";
        const nameB = DISTRICTS.find((d) => d.id === b.districtId)?.name ?? "";
        return nameA.localeCompare(nameB);
      }),
    [buildingList],
  );

  return (
    <div id="app">
      <header>
        <h1>Civ 6 District Discount Tracker</h1>
        <p className="subtitle">
          Clicking a locked district will unlock it, as if you re-searched it in the Civ/Tech tree. You can then set districts as in construction or finished.
        </p>
      </header>

      <section className="controls">
        <label className="checkbox-row">
          <input type="checkbox" checked={useBbg} onChange={(e) => setUseBbg(e.target.checked)} />
          BBG rules
        </label>
        <button type="button" className="reset" onClick={resetAll}>
          Reset all
        </button>
      </section>

      <section className="summary-bar">
        <div className="stat">
          <span className="stat-value">{summary.districtTypesUnlocked}</span>
          <span className="stat-label">district types unlocked (A)</span>
        </div>
        <div className="stat">
          <span className="stat-value">{summary.totalCompleted}</span>
          <span className="stat-label">districts finished (B)</span>
        </div>
        <div className="stat">
          <span className="stat-value">{summary.averageLabel}</span>
          <span className="stat-label">avg finished per type (B/A)</span>
        </div>
        <div className="stat">
          <span className={`stat-value gate-value ${summary.gatingMet ? "gate-met" : "gate-unmet"}`}>
            {summary.totalCompleted} ≥ {summary.districtTypesUnlocked}
          </span>
          <span className="stat-label">B ≥ A?</span>
        </div>
        <div
          className="stat gate-stat"
          title="C(T) is the amount of placed / finished for a district type"
        >
          <span className="gate-row">
            <span className="gate-icon-slot">
              {hasHoverData && focusedDistrict && (
                <img src={focusedDistrict.image} alt={focusedDistrict.name} className="gate-icon" />
              )}
            </span>
            <span className="gate-value-slot">
              {hasHoverData ? (
                <span
                  className={`stat-value gate-value ${
                    hoverBelowAverage ? "gate-met" : "gate-unmet"
                  }`}
                >
                  {hoveredResult!.placedCount} &lt; {summary.averageLabel}
                </span>
              ) : (
                <span className="stat-value gate-value gate-unknown">?</span>
              )}
            </span>
          </span>
          <span className="stat-label gate-label">C(T) &lt; B/A?</span>
        </div>
      </section>

      <section className="board">
        <div
          className={`column ${dragOverColumn === "available" ? "drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverColumn("available");
          }}
          onDragLeave={() => setDragOverColumn(null)}
          onDrop={handleDropOnAvailable}
        >
          <h2>Available</h2>
          <div className="column-body" onMouseLeave={() => setHoveredDistrictId(null)}>
            {SORTED_DISTRICTS.map((d) => {
              const r = resultById.get(d.id)!;
              const maxed = !!d.singleBuild && r.placedCount >= 1;
              return (
                <div
                  key={d.id}
                  className={`district-tile available ${r.unlocked ? "unlocked" : "locked"} ${
                    r.discounted ? "discounted" : ""
                  } ${focusedDistrictId === d.id ? "selected" : ""} ${maxed ? "maxed" : ""}`}
                  draggable={r.unlocked && !maxed}
                  onMouseEnter={() => setHoveredDistrictId(d.id)}
                  onDragStart={(e) => {
                    if (!r.unlocked || maxed) return;
                    e.dataTransfer.setData(
                      DRAG_MIME,
                      JSON.stringify({ source: "available", districtId: d.id } satisfies DragPayload),
                    );
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => {
                    if (r.unlocked) {
                      setSelectedDistrictId((prev) => (prev === d.id ? null : d.id));
                    } else {
                      unlockDistrict(d.id);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!r.unlocked) return;
                    setContextMenu({ x: e.clientX, y: e.clientY, districtId: d.id });
                  }}
                  title={
                    !r.unlocked
                      ? "Click to unlock"
                      : maxed
                        ? "Already built - can only be constructed once."
                        : r.discounted
                          ? "The next one you place is discounted!"
                          : `Finish ${r.districtsNeededForNextDiscount} ${
                              r.building > 0 ? "any" : "other"
                            } district(s) to discount the next one.`
                  }
                >
                  <img src={d.image} alt={d.name} className="district-img" draggable={false} />
                  <div className="district-info">
                    <span className="district-name">{d.name}</span>
                    {maxed ? (
                      <span className="need-hint hint-maxed">Already built</span>
                    ) : (
                      <>
                        {r.unlocked && !r.discounted && (
                          <span className="need-hint">
                            Finish {r.districtsNeededForNextDiscount}{" "}
                            <span className={r.building > 0 ? "hint-any" : "hint-others"}>
                              {r.building > 0 ? "any" : "other"}
                            </span>{" "}
                            district(s)
                          </span>
                        )}
                        {r.discounted && (
                          <span className="need-hint">
                            {d.singleBuild
                              ? "Can be discounted"
                              : `${r.discountsLeft} discount${r.discountsLeft === 1 ? "" : "s"} left`}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {r.discounted && !maxed && (
                    <span className="badge">-{Math.round(r.discountRate * 100)}%</span>
                  )}
                  {maxed && <span className="badge badge-maxed">Maxed out</span>}
                  {r.unlocked && !maxed && (
                    <button
                      type="button"
                      className="build-zone"
                      onClick={(e) => {
                        e.stopPropagation();
                        addBuildingInstance(d.id);
                      }}
                      title="Start building"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  )}
                  {!r.unlocked && (
                    <svg className="lock-overlay" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm0 2a3 3 0 0 1 3 3v3H9V7a3 3 0 0 1 3-3Z"
                      />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={`column ${dragOverColumn === "building" ? "drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverColumn("building");
          }}
          onDragLeave={() => setDragOverColumn(null)}
          onDrop={handleDropOnBuilding}
        >
          <h2>Building</h2>
          <div className="column-body" onMouseLeave={() => setHoveredDistrictId(null)}>
            {buildingList.length === 0 && <p className="empty-hint">Drag districts here</p>}
            {sortedBuildingList.map((b) => {
              const d = DISTRICTS.find((dd) => dd.id === b.districtId)!;
              return (
                <div
                  key={b.uid}
                  className={`district-tile building ${b.discounted ? "discounted" : ""} ${
                    focusedDistrictId === b.districtId ? "selected" : ""
                  }`}
                  draggable
                  onMouseEnter={() => setHoveredDistrictId(b.districtId)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      DRAG_MIME,
                      JSON.stringify({
                        source: "building",
                        uid: b.uid,
                        districtId: b.districtId,
                      } satisfies DragPayload),
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => {
                    setSelectedDistrictId((prev) => (prev === b.districtId ? null : b.districtId));
                  }}
                >
                  <button
                    type="button"
                    className="side-zone side-zone-left side-zone-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBuildingInstance(b.uid);
                    }}
                    title="Cancel — remove from building"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 5l-7 7 7 7"
                      />
                    </svg>
                  </button>
                  <img src={d.image} alt={d.name} className="district-img" draggable={false} />
                  <span className="district-name">{d.name}</span>
                  {b.discounted && (
                    <span className="badge">-{Math.round(b.discountRate * 100)}%</span>
                  )}
                  <button
                    type="button"
                    className="side-zone side-zone-right"
                    onClick={(e) => {
                      e.stopPropagation();
                      completeBuildingInstance(b.uid, b.districtId);
                    }}
                    title="Mark finished"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={`column ${dragOverColumn === "finished" ? "drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverColumn("finished");
          }}
          onDragLeave={() => setDragOverColumn(null)}
          onDrop={handleDropOnFinished}
        >
          <h2>Finished</h2>
          <div className="column-body" onMouseLeave={() => setHoveredDistrictId(null)}>
            {finishedGroups.length === 0 && <p className="empty-hint">Drag districts here</p>}
            {finishedGroups.map(({ district, count }) => (
              <div
                key={district.id}
                className={`district-tile finished ${
                  focusedDistrictId === district.id ? "selected" : ""
                }`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    DRAG_MIME,
                    JSON.stringify({
                      source: "finished",
                      districtId: district.id,
                    } satisfies DragPayload),
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
                onMouseEnter={() => setHoveredDistrictId(district.id)}
                onClick={() => {
                  setSelectedDistrictId((prev) => (prev === district.id ? null : district.id));
                }}
              >
                <button
                  type="button"
                  className="side-zone side-zone-left"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveFinishedToBuilding(district.id);
                  }}
                  title="Move one back to building"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 5l-7 7 7 7"
                    />
                  </svg>
                </button>
                <img src={district.image} alt={district.name} className="district-img" draggable={false} />
                <span className="district-name">{district.name}</span>
                <span className="count-badge">×{count}</span>
                <button
                  type="button"
                  className="side-zone side-zone-right side-zone-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    unfinishDistrict(district.id);
                  }}
                  title="Remove one"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 6l12 12M18 6l-12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              lockDistrict(contextMenu.districtId);
              setContextMenu(null);
            }}
          >
            Re-lock
          </button>
        </div>
      )}
    </div>
  );
}

function readPayload(e: React.DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

export default App;
