import styles from "@/app/success-wishes/Receiver.module.css";

const designs: Record<string, { ornament: string; headline: string }> = {
  heritage: { ornament: "✧", headline: "The future is yours" },
  botanical: { ornament: "✿", headline: "Bloom into greatness" },
  nightfall: { ornament: "✦", headline: "You were made to shine" },
  sunrise: { ornament: "✳", headline: "Go make it happen" },
};

/** Public cover only: never render the sender or private message before reveal. */
export default function ReceiverGift({
  theme = "heritage",
  name,
  label = "A surprise inside",
}: {
  theme?: string;
  name?: string;
  label?: string;
}) {
  const design = designs[theme] || designs.heritage;
  return (
    <div className={styles.giftCover} data-theme={theme}>
      <span>VIBESCHOOL · SUCCESS WISHES</span>
      <b aria-hidden="true">{design.ornament}</b>
      <strong>{design.headline}</strong>
      {name && <small>For {name}</small>}
      <div className={styles.giftSeal}>{label}</div>
    </div>
  );
}
