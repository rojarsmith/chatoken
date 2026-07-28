import Link from "next/link";

export const metadata = {
  title: "Chatoken Console — legacy",
  description: "The original 16-tab console, kept reachable during the restructure"
};

/**
 * The pre-restructure console. Every tab here is being migrated into the stage
 * ladder; this route exists so nothing is unreachable mid-migration and will be
 * removed once the coverage table in docs/restructure-plan.md is satisfied.
 */
export default function LegacyLayout({ children }) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          flexWrap: "wrap",
          padding: "9px 16px",
          background: "#fff7df",
          borderBottom: "1px solid #f0dfae",
          color: "#7a4d06",
          fontSize: "13px"
        }}
      >
        <strong>Legacy console.</strong>
        <span>The ordered course now lives in the stage ladder.</span>
        <Link href="/" style={{ color: "#1d4ed8", fontWeight: 600 }}>
          Go to the ladder →
        </Link>
      </div>
      {children}
    </>
  );
}
