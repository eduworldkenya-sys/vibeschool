import React from "react";
import {createRoot} from "react-dom/client";
import DesignLab from "../../app/teacher/redesign/design-lab";
import s from "../../app/teacher/redesign/redesign.module.css";

// Isolated test-only mount. No app routes, credentials, database or production auth changes.
const params=new URLSearchParams(window.location.search);
const root=document.getElementById("root")!;
createRoot(root).render(<div className={s.shell} data-theme={params.get("theme")||"light"} data-accent={params.get("accent")||"blue"} data-motion="reduce" data-size={params.get("size")||"default"}><main className={s.main}><DesignLab/></main></div>);
