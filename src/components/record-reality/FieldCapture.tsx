import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  FileScan,
  ImageUp,
  Loader2,
  MapPin,
  RefreshCw,
  ScanLine,
  Sparkles,
  SwitchCamera,
  Upload,
  X,
  XCircle,
} from "lucide-react";

/**
 * Field evidence capture: live camera with a geo/time stamp, photo upload,
 * GPS geo-tagging and a DEMO document OCR for 7/12 (Satbara) extracts.
 *
 * The OCR step is a simulation — no text is read from the image. It returns a
 * fixed field set for the selected parcel so the cross-check flow can be shown.
 */

export type SubmitterType = "Citizen Report" | "Field Officer" | "Drone Survey";

export interface CapturedEvidence {
  submitterType: SubmitterType;
  author: string;
  description: string;
  imageUrl: string;
  geoTag: string | null;
  ocrVerified: boolean;
}

export interface CaptureParcel {
  surveyNo: string;
  village: string;
  tehsil: string;
  district: string;
  officialLandUse: string;
  observedLandUse: string;
  areaHectares: number;
  lat: number;
  lon: number;
}

type Tab = "camera" | "upload" | "document";
type Geo = { lat: number; lon: number; accuracy: number | null; source: "gps" | "parcel" };

const fmtCoord = (g: { lat: number; lon: number }) =>
  `${g.lat.toFixed(5)}° N, ${g.lon.toFixed(5)}° E`;
const nowStamp = () =>
  new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Burn a verification band into the photo (survey, place, coordinates, time)
function stampImage(source: CanvasImageSource, w: number, h: number, lines: string[]): string {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1280 / w);
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const band = 26 + lines.length * 22;
  const grad = ctx.createLinearGradient(0, canvas.height - band - 30, 0, canvas.height);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, canvas.height - band - 30, canvas.width, band + 30);
  ctx.fillStyle = "#34d399";
  ctx.fillRect(16, canvas.height - band + 4, 4, band - 20);
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? "700 18px system-ui, sans-serif" : "500 15px system-ui, sans-serif";
    ctx.fillStyle = i === 0 ? "#ffffff" : "rgba(255,255,255,0.85)";
    ctx.fillText(line, 30, canvas.height - band + 4 + i * 22);
  });
  return canvas.toDataURL("image/jpeg", 0.86);
}

// A sample 7/12 extract drawn on canvas, so the OCR demo works without a paper document
function sampleSatbara(p: CaptureParcel): string {
  const c = document.createElement("canvas");
  c.width = 900;
  c.height = 1180;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fbf8ef";
  x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = "#8a7f66";
  x.lineWidth = 3;
  x.strokeRect(30, 30, 840, 1120);
  x.fillStyle = "#2c2a24";
  x.textAlign = "center";
  x.font = "700 30px serif";
  x.fillText("महाराष्ट्र शासन", 450, 90);
  x.font = "600 24px serif";
  x.fillText("गाव नमुना सात — अधिकार अभिलेख पत्रक", 450, 130);
  x.font = "500 19px serif";
  x.fillText("Village Form VII — Record of Rights (7/12 Extract)", 450, 164);
  x.textAlign = "left";
  const rows: [string, string][] = [
    ["गाव / Village", p.village],
    ["तालुका / Taluka", p.tehsil],
    ["जिल्हा / District", p.district],
    ["भूमापन क्रमांक / Survey No.", p.surveyNo],
    ["भोगवटादाराचे नाव / Occupant", "Ramesh Vitthal Pawar"],
    ["क्षेत्र / Area (Ha.Are)", `${p.areaHectares.toFixed(2)}.00`],
    ["पोटखराब / Pot-kharab", "0.04"],
    ["जमिनीचा प्रकार / Land class", "जिरायत (Agricultural)"],
    ["फेरफार क्रमांक / Mutation No.", "4172, 4388"],
    ["आकारणी / Assessment (₹)", "12.40"],
  ];
  x.lineWidth = 1.5;
  rows.forEach(([k, v], i) => {
    const y = 220 + i * 78;
    x.strokeRect(60, y, 780, 78);
    x.beginPath();
    x.moveTo(400, y);
    x.lineTo(400, y + 78);
    x.stroke();
    x.font = "500 20px serif";
    x.fillStyle = "#5a5446";
    x.fillText(k, 76, y + 46);
    x.font = "600 24px serif";
    x.fillStyle = "#1e1c17";
    x.fillText(v, 420, y + 48);
  });
  x.font = "italic 17px serif";
  x.fillStyle = "#6b6453";
  x.fillText("तलाठी सजा — डिजिटल स्वाक्षरीत · Digitally signed extract (sample)", 60, 1062);
  x.strokeStyle = "#b3302f";
  x.lineWidth = 3;
  x.beginPath();
  x.arc(760, 1060, 48, 0, Math.PI * 2);
  x.stroke();
  x.font = "700 14px serif";
  x.fillStyle = "#b3302f";
  x.textAlign = "center";
  x.fillText("TALATHI", 760, 1056);
  x.fillText("SHIRUR", 760, 1074);
  return c.toDataURL("image/png");
}

interface OcrField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  /** Position on the sample document, % of width/height */
  box: [number, number, number, number];
}

function ocrFields(p: CaptureParcel): OcrField[] {
  const row = (i: number): [number, number, number, number] => [
    46,
    ((220 + i * 78) / 1180) * 100,
    47,
    (78 / 1180) * 100,
  ];
  return [
    {
      key: "doc",
      label: "Document",
      value: "7/12 extract (Village Form VII)",
      confidence: 99,
      box: [8, 4, 84, 11],
    },
    { key: "village", label: "Village", value: p.village, confidence: 97, box: row(0) },
    { key: "survey", label: "Survey No.", value: p.surveyNo, confidence: 98, box: row(3) },
    { key: "owner", label: "Occupant", value: "Ramesh Vitthal Pawar", confidence: 91, box: row(4) },
    {
      key: "area",
      label: "Area",
      value: `${p.areaHectares.toFixed(2)} ha`,
      confidence: 95,
      box: row(5),
    },
    {
      key: "class",
      label: "Land class",
      value: "Jirayat (Agricultural)",
      confidence: 93,
      box: row(7),
    },
    {
      key: "mutation",
      label: "Mutation entries",
      value: "4172, 4388",
      confidence: 88,
      box: row(8),
    },
  ];
}

export function FieldCapture({
  parcel,
  onClose,
  onSubmit,
}: {
  parcel: CaptureParcel;
  onClose: () => void;
  onSubmit: (e: CapturedEvidence) => void;
}) {
  const [tab, setTab] = useState<Tab>("camera");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoStamped, setPhotoStamped] = useState(false);
  const [doc, setDoc] = useState<{ url: string; sample: boolean } | null>(null);
  const [role, setRole] = useState<SubmitterType>("Field Officer");
  const [author, setAuthor] = useState("Circle Inspector (Shirur)");
  const [notes, setNotes] = useState("");
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoState, setGeoState] = useState<"locating" | "ok" | "fallback">("locating");

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camState, setCamState] = useState<"idle" | "starting" | "live" | "error">("idle");
  const [camError, setCamError] = useState("");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [flash, setFlash] = useState(false);
  const camTarget = useRef<"photo" | "doc">("photo");

  // OCR
  const [ocr, setOcr] = useState<"idle" | "scanning" | "done">("idle");
  const [ocrStep, setOcrStep] = useState(0);
  const fields = ocrFields(parcel);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamState("idle");
  }, []);

  const startCamera = useCallback(
    async (mode: "environment" | "user" = facing) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamState("error");
        setCamError("This browser doesn't support camera access. Upload a photo instead.");
        return;
      }
      stopCamera();
      setCamState("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        streamRef.current = stream;
        // The <video> is attached in an effect once it is visible (see below)
        setCamState("live");
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        setCamState("error");
        setCamError(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access in the browser's address bar, or upload a photo."
            : name === "NotFoundError"
              ? "No camera was found on this device. Upload a photo instead."
              : "The camera couldn't be started (it may be in use by another app).",
        );
      }
    },
    [facing, stopCamera],
  );

  // Geolocation (falls back to the parcel centroid)
  useEffect(() => {
    const fallback = () => {
      setGeo({ lat: parcel.lat, lon: parcel.lon, accuracy: null, source: "parcel" });
      setGeoState("fallback");
    };
    if (!navigator.geolocation) return fallback();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: "gps",
        });
        setGeoState("ok");
      },
      fallback,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, [parcel.lat, parcel.lon]);

  // Attach the live stream once the video element is on screen
  useEffect(() => {
    const v = videoRef.current;
    const stream = streamRef.current;
    if (camState !== "live" || !v || !stream) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    void v.play().catch(() => undefined);
  }, [camState, tab]);

  // Stop the camera when leaving the camera views or closing
  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const switchTab = (t: Tab) => {
    if (t !== "camera") stopCamera();
    setTab(t);
  };

  const stampLines = () => [
    `Survey ${parcel.surveyNo} · ${parcel.village}, ${parcel.district}`,
    geo
      ? `${fmtCoord(geo)}${geo.source === "parcel" ? " (parcel centroid)" : geo.accuracy ? ` ±${Math.round(geo.accuracy)} m` : ""}`
      : "Location unavailable",
    `${nowStamp()} · ${role} · Bhumi-Niti field capture`,
  ];

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    if (camTarget.current === "doc") {
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      setDoc({ url: c.toDataURL("image/jpeg", 0.9), sample: false });
      setOcr("idle");
      camTarget.current = "photo";
      stopCamera();
      setTab("document");
      return;
    }
    setPhoto(stampImage(v, v.videoWidth, v.videoHeight, stampLines()));
    setPhotoStamped(true);
    stopCamera();
  };

  const readFile = (file: File, target: "photo" | "doc") => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      if (target === "doc") {
        setDoc({ url, sample: false });
        setOcr("idle");
      } else {
        setPhoto(url);
        setPhotoStamped(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const runOcr = () => {
    setOcr("scanning");
    setOcrStep(0);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setOcrStep(i);
      if (i >= fields.length) {
        window.clearInterval(t);
        window.setTimeout(() => setOcr("done"), 350);
      }
    }, 420);
  };

  const dist = geo && geo.source === "gps" ? distanceM(geo, parcel) : null;
  const isAgri = (use: string) => /agri/i.test(use) && !/non-?agri/i.test(use);
  const officialAgri = isAgri(parcel.officialLandUse);
  const satelliteAgri = isAgri(parcel.observedLandUse);
  const checks =
    ocr === "done"
      ? [
          { label: "Survey number matches official record", ok: true },
          { label: `Area ${parcel.areaHectares.toFixed(2)} ha matches official record`, ok: true },
          {
            label: `Recorded land class (Agricultural) vs official record (${parcel.officialLandUse})`,
            ok: officialAgri,
          },
          {
            label: `Recorded land class (Agricultural) vs satellite (${parcel.observedLandUse})`,
            ok: satelliteAgri,
          },
        ]
      : [];
  const mismatch = checks.some((c) => !c.ok);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = [notes.trim()];
    if (ocr === "done")
      parts.push(
        mismatch
          ? "7/12 extract scanned: recorded class Agricultural conflicts with observed built-up use."
          : "7/12 extract scanned: consistent with observed use.",
      );
    onSubmit({
      submitterType: role,
      author: author.trim() || role,
      description: parts.filter(Boolean).join(" ") || "Ground observation report submitted.",
      imageUrl: photo ?? doc?.url ?? "",
      geoTag: geo ? fmtCoord(geo) : null,
      ocrVerified: ocr === "done",
    });
  };

  const canSubmit = !!(photo || doc);

  return (
    <div
      className="fc-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Capture field evidence"
      onClick={onClose}
    >
      <div className="fc" onClick={(e) => e.stopPropagation()}>
        <header className="fc-head">
          <div>
            <span className="fc-eyebrow">
              Ground truth · Survey {parcel.surveyNo}, {parcel.village}
            </span>
            <h3>Capture field evidence</h3>
          </div>
          <button type="button" className="fc-x" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>

        <div className="fc-body">
          {/* Left: capture */}
          <div className="fc-capture">
            <div className="fc-tabs" role="tablist">
              {(
                [
                  ["camera", Camera, "Live camera"],
                  ["upload", ImageUp, "Upload photo"],
                  ["document", FileScan, "Scan 7/12 (OCR)"],
                ] as const
              ).map(([id, Icon, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? "on" : ""}
                  onClick={() => switchTab(id)}
                >
                  <Icon /> {label}
                </button>
              ))}
            </div>

            {tab === "camera" && (
              <div className="fc-stage">
                {photo && camState !== "live" && camState !== "starting" ? (
                  <>
                    <img src={photo} alt="Captured evidence" />
                    <div className="fc-stage-bar top">
                      <span className="fc-badge ok">
                        <CheckCircle2 />{" "}
                        {photoStamped ? "Captured · geo & time stamped" : "Uploaded photo"}
                      </span>
                      <button
                        type="button"
                        className="fc-btn"
                        onClick={() => {
                          setPhoto(null);
                          void startCamera();
                        }}
                      >
                        <RefreshCw /> Retake
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className={camState === "live" ? "" : "hidden"}
                      style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
                    />
                    {camState === "live" && (
                      <>
                        <div className="fc-guides" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                          <i />
                        </div>
                        <div className="fc-live">
                          <span /> LIVE · {geo ? fmtCoord(geo) : "locating…"}
                        </div>
                        {flash && <div className="fc-flash" />}
                        <div className="fc-stage-bar">
                          <button
                            type="button"
                            className="fc-btn ghost"
                            onClick={() => {
                              const next = facing === "environment" ? "user" : "environment";
                              setFacing(next);
                              void startCamera(next);
                            }}
                          >
                            <SwitchCamera /> Flip
                          </button>
                          <button
                            type="button"
                            className="fc-shutter"
                            onClick={capture}
                            aria-label="Capture photo"
                          >
                            <span />
                          </button>
                          <button type="button" className="fc-btn ghost" onClick={stopCamera}>
                            <CameraOff /> Stop
                          </button>
                        </div>
                      </>
                    )}
                    {camState === "starting" && (
                      <div className="fc-empty">
                        <Loader2 className="spin" /> Starting camera…
                      </div>
                    )}
                    {camState === "idle" && (
                      <div className="fc-empty">
                        <Camera />
                        <strong>Photograph the plot on site</strong>
                        <span>
                          Photos are stamped with the survey number, GPS position and time.
                        </span>
                        <button
                          type="button"
                          className="fc-btn primary"
                          onClick={() => {
                            camTarget.current = "photo";
                            void startCamera();
                          }}
                        >
                          <Camera /> Open camera
                        </button>
                      </div>
                    )}
                    {camState === "error" && (
                      <div className="fc-empty">
                        <CameraOff />
                        <strong>Camera unavailable</strong>
                        <span>{camError}</span>
                        <div className="fc-row">
                          <button
                            type="button"
                            className="fc-btn"
                            onClick={() => void startCamera()}
                          >
                            <RefreshCw /> Try again
                          </button>
                          <button
                            type="button"
                            className="fc-btn primary"
                            onClick={() => switchTab("upload")}
                          >
                            <Upload /> Upload instead
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === "upload" && (
              <label className="fc-stage fc-drop">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], "photo")}
                />
                {photo ? (
                  <img src={photo} alt="Uploaded evidence" />
                ) : (
                  <div className="fc-empty">
                    <ImageUp />
                    <strong>Drop a photo or click to choose</strong>
                    <span>JPG or PNG from the site visit. On a phone this opens the camera.</span>
                  </div>
                )}
              </label>
            )}

            {tab === "document" && (
              <div className="fc-stage fc-doc">
                {doc ? (
                  <div className={`fc-docview${ocr === "scanning" ? " scanning" : ""}`}>
                    <div className="fc-docpage">
                      <img src={doc.url} alt="Scanned document" />
                      {ocr === "scanning" && <div className="fc-scanline" />}
                      {doc.sample &&
                        ocr !== "idle" &&
                        fields.slice(0, ocr === "done" ? fields.length : ocrStep).map((f) => (
                          <span
                            key={f.key}
                            className="fc-box"
                            style={{
                              left: `${f.box[0]}%`,
                              top: `${f.box[1]}%`,
                              width: `${f.box[2]}%`,
                              height: `${f.box[3]}%`,
                            }}
                          />
                        ))}
                    </div>
                    <div className="fc-stage-bar">
                      {ocr === "idle" && (
                        <button type="button" className="fc-btn primary" onClick={runOcr}>
                          <ScanLine /> Run OCR
                        </button>
                      )}
                      {ocr === "scanning" && (
                        <span className="fc-badge">
                          <Loader2 className="spin" /> Reading document…{" "}
                          {Math.round((ocrStep / fields.length) * 100)}%
                        </span>
                      )}
                      {ocr === "done" && (
                        <span className="fc-badge ok">
                          <CheckCircle2 /> {fields.length} fields extracted
                        </span>
                      )}
                      <button
                        type="button"
                        className="fc-btn ghost"
                        onClick={() => {
                          setDoc(null);
                          setOcr("idle");
                        }}
                      >
                        <RefreshCw /> Replace
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="fc-empty">
                    <FileScan />
                    <strong>Scan the 7/12 extract</strong>
                    <span>
                      Capture or upload the land record held by the owner. OCR reads the survey
                      number, area and land class and cross-checks them.
                    </span>
                    <div className="fc-row">
                      <button
                        type="button"
                        className="fc-btn"
                        onClick={() => {
                          camTarget.current = "doc";
                          setTab("camera");
                          void startCamera("environment");
                        }}
                      >
                        <Camera /> Camera
                      </button>
                      <label className="fc-btn">
                        <Upload /> Upload
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          hidden
                          onChange={(e) =>
                            e.target.files?.[0] && readFile(e.target.files[0], "doc")
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="fc-btn primary"
                        onClick={() => {
                          setDoc({ url: sampleSatbara(parcel), sample: true });
                          setOcr("idle");
                        }}
                      >
                        <Sparkles /> Use sample 7/12
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: details */}
          <form className="fc-form" onSubmit={submit}>
            <div className={`fc-geo ${geoState}`}>
              <MapPin />
              <div>
                <strong>
                  {geoState === "locating"
                    ? "Getting your location…"
                    : geoState === "ok"
                      ? "GPS location captured"
                      : "Using parcel location"}
                </strong>
                <span>
                  {geo ? fmtCoord(geo) : "—"}
                  {geo?.accuracy ? ` · ±${Math.round(geo.accuracy)} m` : ""}
                </span>
                {dist !== null && (
                  <em className={dist > 500 ? "far" : "near"}>
                    {dist > 500
                      ? `${(dist / 1000).toFixed(1)} km from the plot — flagged for review`
                      : `Within ${Math.round(dist)} m of the plot`}
                  </em>
                )}
                {geoState === "fallback" && (
                  <em>Device location unavailable — tagged with the parcel centroid.</em>
                )}
              </div>
            </div>

            {ocr === "done" && (
              <div className="fc-ocr">
                <div className="fc-ocr-head">
                  <FileScan /> Extracted from 7/12
                  <span className="fc-demo">Demo OCR · simulated</span>
                </div>
                <dl>
                  {fields.slice(1).map((f) => (
                    <div key={f.key}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                      <span className="conf" title="OCR confidence">
                        <i style={{ width: `${f.confidence}%` }} />
                        {f.confidence}%
                      </span>
                    </div>
                  ))}
                </dl>
                <ul className="fc-checks">
                  {checks.map((c) => (
                    <li key={c.label} className={c.ok ? "ok" : "bad"}>
                      {c.ok ? <CheckCircle2 /> : <XCircle />} {c.label}
                    </li>
                  ))}
                </ul>
                {mismatch && (
                  <p className="fc-alert">
                    <AlertTriangle /> Record says agricultural, ground and satellite show built-up
                    use. Conversion (NA) order should be verified.
                  </p>
                )}
              </div>
            )}
            {ocr === "scanning" && (
              <div className="fc-ocr">
                <div className="fc-ocr-head">
                  <Loader2 className="spin" /> Extracting fields…
                </div>
                <ul className="fc-checks">
                  {fields.slice(0, ocrStep).map((f) => (
                    <li key={f.key} className="ok">
                      <CheckCircle2 /> {f.label}: {f.value}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <label>
              Submitted as
              <select value={role} onChange={(e) => setRole(e.target.value as SubmitterType)}>
                <option>Field Officer</option>
                <option>Citizen Report</option>
                <option>Drone Survey</option>
              </select>
            </label>
            <label>
              Name / designation
              <input value={author} onChange={(e) => setAuthor(e.target.value)} required />
            </label>
            <label>
              Observation
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Steel-roof warehouse ~1.4 ha, boundary wall on east side, no crop activity."
              />
            </label>

            <div className="fc-summary">
              <span className={photo ? "ok" : ""}>
                <Camera /> {photo ? "Photo attached" : "No photo yet"}
              </span>
              <span className={ocr === "done" ? "ok" : ""}>
                <FileScan /> {ocr === "done" ? "7/12 verified" : "No document"}
              </span>
              <span className={geo ? "ok" : ""}>
                <MapPin /> {geo ? "Geo-tagged" : "No location"}
              </span>
            </div>

            <div className="fc-actions">
              <button type="button" className="fc-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="fc-btn primary"
                disabled={!canSubmit}
                title={canSubmit ? "" : "Capture a photo or scan a document first"}
              >
                <Upload /> Submit evidence
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
