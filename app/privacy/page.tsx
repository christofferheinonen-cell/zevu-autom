export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px", fontFamily: "sans-serif", color: "#111" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>Last updated: May 2026</p>

      <p>Zevu Ad Workflow is an internal tool used by Zevu to analyse prospect websites and Meta ad activity. It is not a public application and is not available to end users.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>Data collected</h2>
      <p>The tool processes publicly available website content and Meta Ad Library data. No personal data is collected, stored, or shared with third parties.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>Meta API usage</h2>
      <p>This app uses the Meta Ad Library API solely to retrieve publicly visible ad data for business analysis purposes. No user data from Meta is stored.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>Contact</h2>
      <p>For any questions, contact <a href="mailto:christoffer@zevu.fi" style={{ color: "#4F46E5" }}>christoffer@zevu.fi</a></p>
    </main>
  );
}
