"use client";

import { useState, useCallback } from "react";

/* ── Types ── */
interface Ad {
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_snapshot_url?: string;
  impressions?: { lower_bound?: string; upper_bound?: string };
  page_name?: string;
}

interface Analysis {
  targetAudience: string;
  keyBenefits: string[];
  brandTone: string;
  topWeaknesses: string[];
  biggestOpportunity: string;
  improvedAdBrief: {
    headline: string;
    subheadline: string;
    bodyText: string;
    cta: string;
    visualPrompt: string;
  };
}

interface Email {
  subject: string;
  body: string;
}

type StepStatus = "pending" | "running" | "done" | "error";

interface StepState {
  scrape: StepStatus;
  ads: StepStatus;
  analyze: StepStatus;
  image: StepStatus;
  email: StepStatus;
}

/* ── Step config ── */
const STEPS = [
  { key: "scrape", num: "1", title: "Verkkosivuston skannaus", desc: "Firecrawl kerää sivuston sisällön" },
  { key: "ads", num: "2", title: "Meta-mainokset haetaan", desc: "Meta Ad Library API" },
  { key: "analyze", num: "3", title: "Heikkoudet analysoidaan", desc: "Claude analysoi mainostrategian" },
  { key: "image", num: "4", title: "Kuva generoidaan", desc: "Gemini luo mainosvisuaalin" },
  { key: "email", num: "5", title: "Valmis", desc: "Sähköpostiluonnos on valmis" },
] as const;

type StepKey = typeof STEPS[number]["key"];

function stepClass(key: StepKey, steps: StepState): string {
  const s = steps[key];
  if (s === "done") return "step-item done";
  if (s === "running") return "step-item active";
  if (s === "error") return "step-item error";
  return "step-item";
}

function StepIcon({ stepKey, steps }: { stepKey: StepKey; steps: StepState }) {
  const s = steps[stepKey];
  const num = STEPS.find(x => x.key === stepKey)!.num;
  if (s === "running") return <span className="spinner" />;
  if (s === "done") return <span>✓</span>;
  if (s === "error") return <span>✕</span>;
  return <span>{num}</span>;
}

function StatusPill({ status }: { status: StepStatus }) {
  if (status === "pending") return null;
  const map = {
    running: { cls: "running", label: "Käynnissä…" },
    done: { cls: "done", label: "Valmis" },
    error: { cls: "error", label: "Virhe" },
  };
  const { cls, label } = map[status];
  return (
    <span className={`step-status-pill ${cls}`}>
      {status === "running" && <span className="pulse-dot" />}
      {label}
    </span>
  );
}

/* ── Ad Card (Meta mock) ── */
function AdCard({ ad, index }: { ad: Ad; index: number }) {
  const initials = (ad.page_name ?? `Yritys ${index + 1}`)
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();

  const impressionText = (() => {
    const lo = ad.impressions?.lower_bound;
    const hi = ad.impressions?.upper_bound;
    if (lo && hi) return `${lo}–${hi} näyttöä`;
    if (lo) return `${lo}+ näyttöä`;
    return null;
  })();

  return (
    <div className="ad-card">
      <div className="ad-card-header">
        <div className="ad-card-avatar">{initials}</div>
        <div>
          <div className="ad-card-page-name">{ad.page_name ?? `Sivu ${index + 1}`}</div>
          <div className="ad-card-sponsored-row">
            <span className="ad-card-sponsored-tag">Sponsoroitu</span>
            <span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>· Meta</span>
          </div>
        </div>
      </div>
      {ad.ad_creative_bodies?.[0] && (
        <div className="ad-card-body-text">{ad.ad_creative_bodies[0]}</div>
      )}
      <div className="ad-card-image">
        {ad.ad_snapshot_url ? (
          <a href={ad.ad_snapshot_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "var(--text-xs)", color: "var(--primary)" }}>
            Katso mainos Metassa →
          </a>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>Esikatselua ei saatavilla</span>
        )}
      </div>
      <div className="ad-card-footer">
        <span className="ad-card-link-title">{ad.ad_creative_link_titles?.[0] ?? "Lue lisää"}</span>
        <span className="ad-card-cta-btn">Lue lisää</span>
      </div>
      {impressionText && (
        <div className="ad-card-impressions">
          <span>👁</span>
          <span>{impressionText}</span>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function WorkflowPage() {
  const [url, setUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const [steps, setSteps] = useState<StepState>({
    scrape: "pending", ads: "pending", analyze: "pending", image: "pending", email: "pending",
  });
  const [errors, setErrors] = useState<Partial<Record<StepKey, string>>>({});
  const [adsDebug, setAdsDebug] = useState<unknown>(null);

  const [scrapedContent, setScrapedContent] = useState<string | null>(null);
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [email, setEmail] = useState<Email | null>(null);

  const setStep = useCallback((key: StepKey, status: StepStatus) => {
    setSteps(prev => ({ ...prev, [key]: status }));
  }, []);

  const setError = useCallback((key: StepKey, msg: string) => {
    setErrors(prev => ({ ...prev, [key]: msg }));
    setStep(key, "error");
  }, [setStep]);

  async function post<T>(endpoint: string, body: unknown): Promise<T> {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function run() {
    if (!url.trim()) return;
    setRunning(true);
    setErrors({});
    setScrapedContent(null);
    setAds(null);
    setAnalysis(null);
    setImageUrl(null);
    setEmail(null);
    setSteps({ scrape: "pending", ads: "pending", analyze: "pending", image: "pending", email: "pending" });

    /* Step 1 — Scrape */
    setStep("scrape", "running");
    let scraped = "";
    try {
      const data = await post<{ markdown: string; metadata?: unknown }>("/api/scrape", { url: url.trim() });
      scraped = data.markdown;
      setScrapedContent(scraped);
      setStep("scrape", "done");
    } catch (e) {
      setError("scrape", (e as Error).message);
      setRunning(false);
      return;
    }

    const nameForSearch = companyName.trim() || (() => {
      try {
        return new URL(url.trim()).hostname.replace(/^www\./, "").split(".")[0];
      } catch {
        return url.trim();
      }
    })();

    /* Step 2 — Ads (non-fatal) */
    setStep("ads", "running");
    let foundAds: Ad[] = [];
    try {
      const data = await post<{ ads: Ad[]; error?: string; debug?: unknown }>("/api/ads", { companyName: nameForSearch });
      setAdsDebug(data.debug ?? data.error ?? "no debug info");
      if (data.error) throw new Error(data.error);
      foundAds = data.ads ?? [];
      setAds(foundAds);
      setStep("ads", "done");
    } catch (e) {
      setError("ads", (e as Error).message);
      setAds([]);
      /* continue — fall back to website-only analysis */
    }

    /* Step 3 — Analyze */
    setStep("analyze", "running");
    let analysisResult: Analysis | null = null;
    try {
      const data = await post<Analysis>("/api/analyze", { scrapedContent: scraped, ads: foundAds });
      analysisResult = data;
      setAnalysis(data);
      setStep("analyze", "done");
    } catch (e) {
      setError("analyze", (e as Error).message);
      setRunning(false);
      return;
    }

    /* Step 4 — Generate image */
    setStep("image", "running");
    let generatedImage: string | null = null;
    try {
      const data = await post<{ imageUrl: string | null }>("/api/generate-image", {
        visualPrompt: analysisResult!.improvedAdBrief.visualPrompt,
      });
      generatedImage = data.imageUrl;
      setImageUrl(generatedImage);
      setStep("image", "done");
    } catch (e) {
      setError("image", (e as Error).message);
      /* non-fatal — show text-only concept */
    }

    /* Step 5 — Draft email */
    setStep("email", "running");
    try {
      const data = await post<Email>("/api/draft-email", {
        companyName: companyName.trim() || nameForSearch,
        url: url.trim(),
        analysis: analysisResult,
        improvedAd: analysisResult!.improvedAdBrief,
      });
      setEmail(data);
      setStep("email", "done");
    } catch (e) {
      setError("email", (e as Error).message);
    }

    setRunning(false);
  }

  function copyEmail() {
    if (!email) return;
    navigator.clipboard.writeText(`Aihe: ${email.subject}\n\n${email.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasResults = !!(scrapedContent || ads !== null || analysis || email);
  const isDone = steps.email === "done";

  return (
    <main className="page-root">
      <div className="page-inner">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-eyebrow">
            <span>⚡</span>
            <span>Zevu Ad Workflow</span>
          </div>
          <h1>Mainokset paremmiksi.<br />Asiakkaat tulevat.</h1>
          <p>
            Syötä prospektin URL, niin Zevu skannaa sivuston, etsii Meta-mainokset,
            tunnistaa heikkoudet ja luo parannetun mainoskonseptin sekä sähköpostiluonnoksen.
          </p>
        </div>

        <div className="two-col">
          {/* ── LEFT: Form + Steps ── */}
          <div className="col-left">
            <div className="card" style={{ marginBottom: "var(--space-6)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
                <div className="input-group">
                  <label className="input-label">Verkkosivuston URL</label>
                  <input
                    className="input"
                    type="url"
                    placeholder="https://yritys.fi"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !running && run()}
                    disabled={running}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Yrityksen nimi <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(valinnainen)</span></label>
                  <input
                    className="input"
                    type="text"
                    placeholder="Esim. Yritys Oy"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !running && run()}
                    disabled={running}
                  />
                </div>
              </div>
              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%", borderRadius: "var(--radius-md)" }}
                onClick={run}
                disabled={running || !url.trim()}
              >
                {running ? (
                  <><span className="spinner" /> Analysoidaan…</>
                ) : (
                  <>Analysoi mainokset →</>
                )}
              </button>
            </div>

            {/* Steps */}
            <div className="card">
              <div style={{ marginBottom: "var(--space-4)" }}>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Prosessin vaiheet
                </span>
              </div>
              <div className="steps-list">
                {STEPS.map(step => (
                  <div key={step.key} className={stepClass(step.key as StepKey, steps)}>
                    <div className="step-icon">
                      <StepIcon stepKey={step.key as StepKey} steps={steps} />
                    </div>
                    <div className="step-content">
                      <div className="step-title">{step.title}</div>
                      <div className="step-desc">{step.desc}</div>
                      <StatusPill status={steps[step.key as StepKey]} />
                      {errors[step.key as StepKey] && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--error)", marginTop: "var(--space-1)", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
                          <span style={{ flex: 1 }}>{errors[step.key as StepKey]}</span>
                          <button onClick={() => setErrors(prev => { const n = {...prev}; delete n[step.key as StepKey]; return n; })} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)", fontWeight: 700, fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}>✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Results ── */}
          <div className="col-right">
            {!hasResults && !running && (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">🎯</div>
                  <div className="empty-state-title">Analyysi odottaa käynnistystä</div>
                  <div className="empty-state-desc">
                    Syötä prospektin URL vasemmalle ja käynnistä analyysi. Tulokset ilmestyvät tähän vaihe vaiheelta.
                  </div>
                </div>
              </div>
            )}

            {hasResults && (
              <div className="results-section">

                {/* Website analysis */}
                {(scrapedContent || steps.scrape === "running") && (
                  <div className="result-block">
                    <div className="result-block-header">
                      <div className="result-block-title">
                        <div className="result-block-icon">🌐</div>
                        Verkkosivuston analyysi
                      </div>
                      {steps.scrape === "done" && <span className="badge badge-success">✓ Skannattu</span>}
                      {steps.scrape === "running" && <span className="badge badge-neutral"><span className="spinner" /></span>}
                    </div>
                    <div className="result-block-body">
                      {steps.scrape === "running" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                          {[100, 80, 90, 60].map((w, i) => (
                            <div key={i} className="skeleton" style={{ height: 14, width: `${w}%` }} />
                          ))}
                        </div>
                      )}
                      {scrapedContent && (
                        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.65, maxHeight: 160, overflow: "hidden", position: "relative" }}>
                          {scrapedContent.slice(0, 600)}{scrapedContent.length > 600 ? "…" : ""}
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, background: "linear-gradient(to bottom, transparent, var(--surface))" }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Meta ads */}
                {(ads !== null || steps.ads === "running") && (
                  <div className="result-block">
                    <div className="result-block-header">
                      <div className="result-block-title">
                        <div className="result-block-icon">📢</div>
                        Meta-mainokset
                      </div>
                      {steps.ads === "done" && (
                        <span className={`badge ${ads && ads.length > 0 ? "badge-success" : "badge-warning"}`}>
                          {ads && ads.length > 0 ? `${ads.length} löydetty` : "Ei mainoksia"}
                        </span>
                      )}
                      {steps.ads === "running" && <span className="badge badge-neutral"><span className="spinner" /></span>}
                      {steps.ads === "error" && <span className="badge badge-error">Virhe</span>}
                    </div>
                    <div className="result-block-body">
                      {steps.ads === "running" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                          {[1, 2].map(i => (
                            <div key={i} className="skeleton" style={{ height: 120, borderRadius: "var(--radius-md)" }} />
                          ))}
                        </div>
                      )}
                      {ads !== null && ads.length === 0 && steps.ads !== "running" && (
                        <>
                          <div className="alert alert-warning">
                            <span>⚠️</span>
                            <div>
                              <strong>Ei aktiivisia Meta-mainoksia löydetty.</strong>{" "}
                              Analyysi jatkuu pelkän verkkosivuston perusteella — tämä voi itsessään olla merkittävä mahdollisuus.
                            </div>
                          </div>
                          {adsDebug && (
                            <pre style={{ fontSize: 11, background: "#f4f4f4", padding: 8, borderRadius: 6, overflow: "auto", marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                              {JSON.stringify(adsDebug, null, 2)}
                            </pre>
                          )}
                        </>
                      )}
                      {ads && ads.length > 0 && (
                        <div className="ads-grid">
                          {ads.map((ad, i) => <AdCard key={i} ad={ad} index={i} />)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Analysis */}
                {(analysis || steps.analyze === "running") && (
                  <div className="result-block">
                    <div className="result-block-header">
                      <div className="result-block-title">
                        <div className="result-block-icon">🔍</div>
                        Heikkousanalyysi
                      </div>
                      {steps.analyze === "done" && <span className="badge badge-success">✓ Analysoitu</span>}
                      {steps.analyze === "running" && <span className="badge badge-neutral"><span className="spinner" /></span>}
                    </div>
                    <div className="result-block-body">
                      {steps.analyze === "running" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                          {[100, 75, 90, 60, 80].map((w, i) => (
                            <div key={i} className="skeleton" style={{ height: 14, width: `${w}%` }} />
                          ))}
                        </div>
                      )}
                      {analysis && (
                        <>
                          <div className="analysis-grid">
                            <div className="analysis-item">
                              <div className="analysis-item-label">Kohderyhmä</div>
                              <div className="analysis-item-value">{analysis.targetAudience}</div>
                            </div>
                            <div className="analysis-item">
                              <div className="analysis-item-label">Brändin sävy</div>
                              <div className="analysis-item-value">{analysis.brandTone}</div>
                            </div>
                          </div>
                          {analysis.keyBenefits?.length > 0 && (
                            <div style={{ marginBottom: "var(--space-4)" }}>
                              <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "var(--space-2)" }}>Vahvuudet</div>
                              <div className="chips-row">
                                {analysis.keyBenefits.map((b, i) => <span key={i} className="chip">{b}</span>)}
                              </div>
                            </div>
                          )}
                          <div style={{ marginBottom: "var(--space-4)" }}>
                            <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "var(--space-3)" }}>Tunnistetut heikkoudet</div>
                            <div className="weakness-list">
                              {analysis.topWeaknesses.map((w, i) => (
                                <div key={i} className="weakness-item">
                                  <div className="weakness-num">{i + 1}</div>
                                  <div className="weakness-text">{w}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="opportunity-block">
                            <div className="opportunity-label">Suurin mahdollisuus</div>
                            <div className="opportunity-text">{analysis.biggestOpportunity}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Improved ad concept */}
                {(analysis || steps.image === "running" || steps.image === "done") && analysis?.improvedAdBrief && (
                  <div className="result-block">
                    <div className="result-block-header">
                      <div className="result-block-title">
                        <div className="result-block-icon">✨</div>
                        Parannettu mainoskonsepti
                      </div>
                      {steps.image === "done" && <span className="badge badge-success">✓ Kuva generoitu</span>}
                      {steps.image === "running" && <span className="badge badge-neutral"><span className="spinner" /> Generoidaan…</span>}
                      {steps.image === "error" && <span className="badge badge-warning">Vain teksti</span>}
                    </div>
                    <div className="result-block-body">
                      <div className="concept-card">
                        <div className="concept-image-area">
                          {steps.image === "running" && (
                            <div className="concept-image-placeholder">
                              <div className="concept-image-placeholder-icon">🎨</div>
                              <div className="concept-image-placeholder-text">Gemini generoi kuvaa…</div>
                            </div>
                          )}
                          {imageUrl && steps.image === "done" && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl} alt="Generated ad visual" />
                          )}
                          {!imageUrl && steps.image !== "running" && (
                            <div className="concept-image-placeholder">
                              <div className="concept-image-placeholder-icon">🖼</div>
                              <div className="concept-image-placeholder-text">
                                {analysis.improvedAdBrief.visualPrompt}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="concept-content">
                          <div className="concept-headline">{analysis.improvedAdBrief.headline}</div>
                          <div className="concept-subheadline">{analysis.improvedAdBrief.subheadline}</div>
                          <div className="concept-body-text">{analysis.improvedAdBrief.bodyText}</div>
                          <div className="concept-cta-btn">{analysis.improvedAdBrief.cta} →</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Draft email */}
                {(email || steps.email === "running") && (
                  <div className="result-block">
                    <div className="result-block-header">
                      <div className="result-block-title">
                        <div className="result-block-icon">📧</div>
                        Sähköpostiluonnos
                      </div>
                      {isDone && <span className="badge badge-success">✓ Valmis</span>}
                      {steps.email === "running" && <span className="badge badge-neutral"><span className="spinner" /></span>}
                    </div>
                    {steps.email === "running" && (
                      <div className="result-block-body">
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                          {[100, 85, 70, 90, 60].map((w, i) => (
                            <div key={i} className="skeleton" style={{ height: 13, width: `${w}%` }} />
                          ))}
                        </div>
                      </div>
                    )}
                    {email && (
                      <div className="email-card" style={{ margin: "0", border: "none", borderRadius: 0, boxShadow: "none" }}>
                        <div className="email-toolbar">
                          <div className="email-subject-label">Aihe</div>
                          <div className="email-subject">{email.subject}</div>
                        </div>
                        <div className="email-body">{email.body}</div>
                        <div className="email-actions">
                          {copied && (
                            <span className="copy-confirm">
                              <span>✓</span> Kopioitu!
                            </span>
                          )}
                          <button className="btn btn-outline btn-sm" onClick={copyEmail}>
                            📋 Kopioi sähköposti
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
