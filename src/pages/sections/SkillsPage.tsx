import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CatalogSkill } from "../../lib/api";
import HomeView from "../../components/workspace/HomeView";
import SkillReader from "../../components/workspace/SkillReader";
import { catColor, iconStyleFor, statusStyleFor, type HomeChrome } from "./shared";
import type { ResearchCardVal } from "../../components/workspace/types";

interface Props {
  sub?: string;
  chrome: HomeChrome;
}

export default function SkillsPage({ sub, chrome }: Props) {
  const navigate = useNavigate();
  const [catSkills, setCatSkills] = useState<CatalogSkill[]>([]);

  useEffect(() => {
    api.catalogSkills().then((d) => setCatSkills(d.skills)).catch(() => {});
  }, []);

  const isDetail = sub !== undefined;
  const itemId = isDetail ? decodeURIComponent(sub) : "";
  const backToSection = () => navigate("/skills");

  const cards: ResearchCardVal[] = catSkills.map((s) => {
    const c = catColor(s.category);
    return { title: s.name, meta: s.description, status: s.category, updated: s.tags[0] ?? "", icon: "◆", open: () => navigate(`/skills/${encodeURIComponent(s.name)}`), iconStyle: iconStyleFor(c), statusStyle: statusStyleFor(c) };
  });

  if (isDetail) {
    return <SkillReader name={itemId} backLabel="Skills" backToSection={backToSection} />;
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
