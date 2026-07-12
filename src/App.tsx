import { useMemo, useState } from "react";
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
}

type DragPayload =
  | { source: "available"; districtId: string }
  | { source: "building"; uid: string; districtId: string };

const DRAG_MIME = "application/json";

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
  const [dragOverColumn, setDragOverColumn] = useState<"building" | "finished" | null>(null);

  const ruleset = useBbg ? BBG : VANILLA;

  const summary = useMemo(
    () => computeDiscounts(DISTRICTS, unlocked, finishedCounts, ruleset),
    [unlocked, finishedCounts, ruleset],
  );
  const resultById = useMemo(() => {
    const map = new Map<string, (typeof summary.results)[number]>();
    for (const r of summary.results) map.set(r.id, r);
    return map;
  }, [summary]);

  function toggleUnlocked(id: string) {
    setUnlocked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function addBuildingInstance(districtId: string) {
    setBuildingList((prev) => [...prev, { uid: crypto.randomUUID(), districtId }]);
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

  function resetAll() {
    setUnlocked({});
    setBuildingList([]);
    setFinishedCounts({});
  }

  function handleDropOnBuilding(e: React.DragEvent) {
    e.preventDefault();
    setDragOverColumn(null);
    const payload = readPayload(e);
    if (!payload || payload.source !== "available") return;
    addBuildingInstance(payload.districtId);
  }

  function handleDropOnFinished(e: React.DragEvent) {
    e.preventDefault();
    setDragOverColumn(null);
    const payload = readPayload(e);
    if (!payload) return;
    if (payload.source === "available") {
      finishDistrict(payload.districtId);
    } else {
      removeBuildingInstance(payload.uid);
      finishDistrict(payload.districtId);
    }
  }

  const finishedGroups = DISTRICTS.map((d) => ({
    district: d,
    count: finishedCounts[d.id] ?? 0,
  })).filter((g) => g.count > 0);

  return (
    <div id="app">
      <header>
        <h1>Civ 6 District Discount Tracker</h1>
        <p className="subtitle">
          Click a district to unlock it. Drag it into "Building" to start construction, then drag
          into "Finished" to complete it — or drag straight from "Available" to "Finished".
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
          <span className="stat-label">district types unlocked</span>
        </div>
        <div className="stat">
          <span className="stat-value">{summary.totalDistrictsBuilt}</span>
          <span className="stat-label">districts finished</span>
        </div>
        <div className="stat">
          <span className="stat-value">{summary.average}</span>
          <span className="stat-label">discount threshold (avg)</span>
        </div>
      </section>

      <section className="board">
        <div className="column">
          <h2>Available</h2>
          <div className="column-body">
            {DISTRICTS.map((d) => {
              const r = resultById.get(d.id)!;
              return (
                <div
                  key={d.id}
                  className={`district-tile ${r.unlocked ? "unlocked" : "locked"} ${
                    r.discounted ? "discounted" : ""
                  }`}
                  draggable={r.unlocked}
                  onDragStart={(e) => {
                    if (!r.unlocked) return;
                    e.dataTransfer.setData(
                      DRAG_MIME,
                      JSON.stringify({ source: "available", districtId: d.id } satisfies DragPayload),
                    );
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => toggleUnlocked(d.id)}
                  title={r.unlocked ? "Click to lock" : "Click to unlock"}
                >
                  <img src={d.image} alt={d.name} className="district-img" draggable={false} />
                  <span className="district-name">{d.name}</span>
                  {r.discounted && (
                    <span className="badge">-{Math.round(r.discountRate * 100)}%</span>
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
          <div className="column-body">
            {buildingList.length === 0 && <p className="empty-hint">Drag districts here</p>}
            {buildingList.map((b) => {
              const d = DISTRICTS.find((dd) => dd.id === b.districtId)!;
              return (
                <div
                  key={b.uid}
                  className="district-tile building"
                  draggable
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
                >
                  <img src={d.image} alt={d.name} className="district-img" draggable={false} />
                  <span className="district-name">{d.name}</span>
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeBuildingInstance(b.uid)}
                    title="Remove"
                  >
                    ×
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
          <div className="column-body">
            {finishedGroups.length === 0 && <p className="empty-hint">Drag districts here</p>}
            {finishedGroups.map(({ district, count }) => (
              <div key={district.id} className="district-tile finished">
                <img src={district.image} alt={district.name} className="district-img" draggable={false} />
                <span className="district-name">{district.name}</span>
                <span className="count-badge">×{count}</span>
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => unfinishDistrict(district.id)}
                  title="Remove one"
                >
                  −
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
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
