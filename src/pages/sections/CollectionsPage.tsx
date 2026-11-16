import { useNavigate } from "react-router-dom";
import HomeView from "../../components/workspace/HomeView";
import ItemDetailView from "../../components/workspace/ItemDetailView";
import { datasets, type HomeChrome } from "./shared";
import type { ResearchCardVal } from "../../components/workspace/types";

interface Props {
  sub?: string;
  chrome: HomeChrome;
}

export default function CollectionsPage({ sub, chrome }: Props) {
  const navigate = useNavigate();
  const isDetail = sub !== undefined;
  const itemId = isDetail ? decodeURIComponent(sub) : "";
  const backToSection = () => navigate("/collections");

  const openCard = (title: string) => navigate(`/collections/${encodeURIComponent(title)}`);
  const cards: ResearchCardVal[] = (datasets.collections || []).map((r) => ({
    title: r[0],
    meta: r[1],
    status: r[2],
    updated: r[5],
    icon: r[4],
    open: () => openCard(r[0]),
    iconStyle: `flex:0 0 auto; width:38px; height:38px; border-radius:9px; background:${r[3][1]}; color:${r[3][0]}; display:flex; align-items:center; justify-content:center; font-size:16px;`,
    statusStyle: `font-size:11px; padding:2px 9px; border-radius:12px; background:${r[3][1]}; color:${r[3][0]}; font-weight:500;`,
  }));

  if (isDetail) {
    const itemRow = (datasets.collections || []).find((r) => r[0] === itemId);
    if (itemRow) {
      return (
        <ItemDetailView
          section="collections"
          sectionLabel={chrome.homeTitle}
          title={itemRow[0]}
          meta={itemRow[1]}
          status={itemRow[2]}
          updated={itemRow[5]}
          icon={itemRow[4]}
          iconStyle={`width:52px; height:52px; border-radius:14px; background:${itemRow[3][1]}; color:${itemRow[3][0]}; display:flex; align-items:center; justify-content:center; font-size:22px;`}
          statusStyle={`font-size:11.5px; padding:3px 11px; border-radius:12px; background:${itemRow[3][1]}; color:${itemRow[3][0]}; font-weight:500;`}
          backToSection={backToSection}
        />
      );
    }
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#8a8680", fontSize: 14 }}>
        Not found.{" "}
        <button onClick={backToSection} style={{ marginLeft: 6, background: "none", border: "none", color: "#2b5fd1", cursor: "pointer", fontSize: 14 }}>
          Back to {chrome.homeTitle}
        </button>
      </div>
    );
  }

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
