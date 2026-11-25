import {createRoot} from "react-dom/client";
import TeacherRedesignPage from "../../app/teacher/redesign/page";
// Local browser fixture only; mounts the actual mock-data app, without a production auth bypass.
createRoot(document.getElementById("root")!).render(<TeacherRedesignPage/>);
