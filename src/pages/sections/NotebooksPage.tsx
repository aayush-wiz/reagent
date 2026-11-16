import { useNavigate } from "react-router-dom";
import HomeView from "../../components/workspace/HomeView";
import NotebookJupyterView from "../../components/workspace/NotebookJupyterView";
import NotebookPyView from "../../components/workspace/NotebookPyView";
import { datasets, type HomeChrome } from "./shared";
import type { ResearchCardVal } from "../../components/workspace/types";

interface Props {
  sub?: string;
  chrome: HomeChrome;
}

export default function NotebooksPage({ sub, chrome }: Props) {
  const navigate = useNavigate();
  const isDetail = sub !== undefined;
  const nbName = isDetail ? decodeURIComponent(sub) : "";
  const nbType = nbName.endsWith(".py") ? "py" : "ipynb";
  const backToNotebooks = () => navigate("/notebooks");

  const openCard = (title: string) => navigate(`/notebooks/${encodeURIComponent(title)}`);
  // Notebooks section: only surface .ipynb notebooks for now (hide raw .py files).
  const rows = (datasets.notebooks || []).filter((r) => r[0].endsWith(".ipynb"));
  const cards: ResearchCardVal[] = rows.map((r) => ({
    title: r[0],
    meta: r[1],
    status: r[2],
    updated: r[5],
    icon: r[4],
    open: () => openCard(r[0]),
    iconStyle: `flex:0 0 auto; width:38px; height:38px; border-radius:9px; background:${r[3][1]}; color:${r[3][0]}; display:flex; align-items:center; justify-content:center; font-size:16px;`,
    statusStyle: `font-size:11px; padding:2px 9px; border-radius:12px; background:${r[3][1]}; color:${r[3][0]}; font-weight:500;`,
  }));

  if (isDetail && nbType === "ipynb") return <NotebookJupyterView nbName={nbName} backToNotebooks={backToNotebooks} />;
  if (isDetail && nbType === "py") return <NotebookPyView nbName={nbName} backToNotebooks={backToNotebooks} />;

  return (
    <HomeView
      nav={chrome.nav}
      homeTitle={chrome.homeTitle}
      homeSub={chrome.homeSub}
      researches={cards}
      openTask={chrome.openTask}
      newAction={chrome.openTask}
      menuOpen={chrome.menuOpen}
      toggleMenu={chrome.toggleMenu}
      menuItems={chrome.menuItems}
    />
  );
}
