import styles from './MiniExplore.module.css'

// Uncommissioned feed: never simulate creators, posts, requests or engagement.
export function MiniExplore() {
  return <div className={styles.explorePage}>
    <div className={styles.container}>
      <div className={styles.exploreTop}>
        <div><h1 className={styles.exploreTitle}>Mini Lessons</h1></div>
      </div>
      <section className={styles.empty} aria-label="Mini Lessons availability">
        <h2>Mini Lessons are coming soon.</h2>
        <p role="status">Publishing is not yet available.</p>
      </section>
    </div>
  </div>
}
