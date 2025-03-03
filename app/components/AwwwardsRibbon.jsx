// components/AwwwardsRibbon.js
"use client";
import { useEffect } from "react";
import Script from "next/script";

export default function AwwwardsRibbon() {
  useEffect(() => {
    // Any client-side initialization can go here if needed
  }, []);

  return (
    <>
      <div
        id="awwwards-embed"
        data-appearance="vertical"
        data-color="#A69382"
        data-category="E-commerce"
        data-date="Feb. 25"
        data-link="https://www.awwwards.com/sites/wooz-experience"
      >
        <p>
          He sido nominado como{" "}
          <strong>submission.awardCategory.nameHonors</strong> en{" "}
          <a href="https://www.awwwards.com/">Awwwards</a>.
        </p>
      </div>
      <Script
        src="https://assets.awwwards.com/assets/js/embed_ribbon.js"
        strategy="afterInteractive"
      />
    </>
  );
}
