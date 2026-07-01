/* CK3 Random Ruler Generator — pure vanilla JS, consumes data.js (or data.json) */
(() => {
  "use strict";

  let DATA = null;
  let TRAITS = [], BY_ID = {};
  const $ = (id) => document.getElementById(id);
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];
  const shuffle = (a) => { a = a.slice(); for (let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; };
  const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));

  const COST_CEILING = 1000; // exclude immortal (10000) from random gen
  const SKILL_MIN_DISPLAY = 5; // default skill shown

  const EXTRA_CATS = [
    ["congenital", "Congenital"], ["fame", "Fame"], ["lifestyle", "Lifestyle"],
    ["commander", "Commander"], ["health", "Health"], ["childhood", "Childhood"],
    ["winter_commander", "Winter Commander"], ["other", "Other"],
  ];
  const DEFAULT_EXTRA = new Set(["congenital", "fame", "lifestyle"]);

  const SKILL_KEYS = ["diplomacy","martial","stewardship","intrigue","learning","prowess"];
  const SKILLS = [
    ["diplomacy","Diplomacy",false], ["martial","Martial",false], ["stewardship","Stewardship",false],
    ["intrigue","Intrigue",false], ["learning","Learning",false], ["prowess","Prowess",true],
  ];

  const CAT_LABELS = {
    education:"Education", personality:"Personality", congenital:"Congenital", lifestyle:"Lifestyle",
    fame:"Fame", commander:"Commander", health:"Health", childhood:"Childhood",
    winter_commander:"Winter Commander", other:"Other",
  };
  const CAT_ORDER = ["education","personality","congenital","lifestyle","fame","commander","health","childhood","winter_commander","other"];

  // ---------- presentation only (icons / labels) ----------
  const SKILL_ICONS = {
    diplomacy:"ph-handshake", martial:"ph-sword", stewardship:"ph-coins",
    intrigue:"ph-mask-happy", learning:"ph-book-open", prowess:"ph-shield",
  };
  const CAT_ICONS = {
    education:"ph-graduation-cap", personality:"ph-mask-happy", congenital:"ph-dna",
    lifestyle:"ph-tree", fame:"ph-medal", commander:"ph-flag-banner", health:"ph-heartbeat",
    childhood:"ph-baby", winter_commander:"ph-snowflake", other:"ph-seal",
  };
  const skillQuality = (v) => v <= 4 ? "Poor" : v <= 8 ? "Average" : v <= 11 ? "Skilled" : v <= 15 ? "Gifted" : "Exceptional";
  const prettyHeritage = (h) => h ? h.replace(/^heritage_/,"").replace(/_/g," ").replace(/\b\w/g, m => m.toUpperCase()) : "";
  function effText(t) {
    const m = t.modifiers || {}; const keys = Object.keys(m);
    if (!keys.length) return "";
    const parts = keys.slice(0, 6).map(k => (m[k] > 0 ? "+" : "") + m[k] + " " + k.replace(/_/g, " "));
    return parts.join(" · ") + (keys.length > 6 ? " …" : "");
  }

  // ---------- UI helpers ----------
  function makeChip(kind, value, label, count, on) {
    const l = document.createElement("label");
    l.className = "chk";
    l.innerHTML = '<input type="checkbox" data-kind="'+kind+'" value="'+value+'" '+(on?"checked":"")+'>'
      + '<span class="box"><i class="ph ph-check" aria-hidden="true"></i></span>'
      + '<span>'+label+' <span class="dim">'+count+'</span></span>';
    return l;
  }
  function setChip(input, on){ input.checked = on; }
  const checkedVals = (kind) =>
    new Set([...document.querySelectorAll('input[data-kind="'+kind+'"]:checked')].map(i => i.value));

  function fillSelect(sel, items) {
    const sorted = items.slice().sort((a,b) => a.name.localeCompare(b.name, "en"));
    sel.innerHTML = sorted.map(x => '<option value="'+x.id+'">'+x.name+'</option>').join("");
  }

  // ---------- rules ----------
  function conflicts(a, b) {
    if (a.id === b.id) return true;
    if (a.opposites && a.opposites.includes(b.id)) return true;
    if (b.opposites && b.opposites.includes(a.id)) return true;
    if (a.group && b.group && a.group === b.group) return true;
    return false;
  }
  const conflictsAny = (t, chosen) => chosen.some(c => conflicts(t, c));

  // Weighted-random ordering that softly favors traits boosting `focus` (traits that
  // don't help it get weight ~1, anti-focus traits weight 0 and sink to the end).
  // Not a deterministic pick, so no single trait is forced for a given focus.
  function focusOrder(pool, focus) {
    if (!focus) return pool;
    const w = (t) => Math.max(0, 1 + (((t.modifiers && t.modifiers[focus]) || 0)));
    return pool
      .map(t => ({ t, k: w(t) * Math.random() }))
      .sort((a, b) => b.k - a.k)
      .map(x => x.t);
  }

  // Age cost = floor(age * multiplier). The multiplier array has one extra leading entry
  // vs the levels array, so the multiplier for a level is at index+1. Verified against
  // in-game totals (age 18->48, 30->66, 33->62).
  function ageCost(age) {
    const al = DATA.config.age_curve.age_levels, mu = DATA.config.age_curve.multipliers;
    let idx = al.length;
    for (let i = 0; i < al.length; i++) { if (al[i] >= age) { idx = i; break; } }
    const m = (mu[idx + 1] != null) ? mu[idx + 1] : mu[mu.length - 1];
    return Math.max(0, Math.floor(age * m));
  }

  // Skill point cost = cumulative table value for the BASE (bought) value, from zero.
  // The displayed skill = base + trait modifiers; only the base costs points.
  function tableCost(base, isProwess) {
    const t = isProwess ? DATA.config.attribute_costs.prowess.table
                        : DATA.config.attribute_costs.general.table;
    return t[String(clamp(base, 0, 20))] || 0;
  }
  function rollDisplay() {
    let v = 5 + rand(7);                 // 5..11
    if (Math.random() < 0.25) v += rand(5); // occasional spike up to ~15
    return clamp(v, 0, 18);
  }

  function eduInfo(edu) {
    if (!edu) return { skill: null, bonus: 0 };
    let skill = edu.group ? edu.group.replace("education_", "") : null;
    if (!SKILL_KEYS.includes(skill)) skill = null;
    let bonus = (skill && edu.modifiers && edu.modifiers[skill]) ? edu.modifiers[skill] : 0;
    if (!skill && edu.modifiers) {
      for (const k of SKILL_KEYS) {
        if (edu.modifiers[k] && edu.modifiers[k] > bonus) { skill = k; bonus = edu.modifiers[k]; }
      }
    }
    return { skill, bonus };
  }

  function skillModsOf(chosen) {
    const m = {}; SKILL_KEYS.forEach(k => m[k] = 0);
    chosen.forEach(t => { const mo = t.modifiers || {}; SKILL_KEYS.forEach(k => { if (mo[k]) m[k] += mo[k]; }); });
    return m;
  }

  // ---------- generation ----------
  function generate() {
    const ownedDlc = checkedVals("dlc");
    const extraCats = checkedVals("cat");
    const capOn = $("achievementToggle").checked;
    const ageOn = true; // age cost is always counted (toggle removed by request)
    const cap = DATA.config.point_cap;
    const minPts = parseInt($("minPoints").value, 10) || 0;
    const focus = $("focusSel").value; // "" or a skill key

    const pool = TRAITS.filter(t => (!t.dlc || ownedDlc.has(t.dlc)) && Math.abs(t.cost) < COST_CEILING);
    const byCat = (c) => pool.filter(t => t.category === c);

    // age (locked or random)
    let age;
    if ($("ageLock").checked) age = clamp(parseInt($("ageInput").value, 10) || 30, 16, 70);
    else age = 16 + rand(45);
    $("ageInput").value = age;
    const aCost = ageOn ? ageCost(age) : 0;

    const chosen = [];
    let traitSpent = 0;

    // 1) education — prefer the focus branch when a focus is set
    let education = null;
    const eduPool = byCat("education");
    if (focus && focus !== "prowess") {
      // randomize across the focus branch's 5 education tiers (was: always the highest).
      // A cheaper tier frees budget that the skill fill and other traits pick up, and the
      // focus skill still lands at its 12-16 target regardless of the education level.
      const focusEdus = eduPool.filter(t => t.group === "education_" + focus
                                            && (!capOn || t.cost <= cap - aCost));
      if (focusEdus.length) education = pick(focusEdus);
    }
    if (!education) { for (const t of shuffle(eduPool)) { if (!capOn || t.cost <= cap - aCost) { education = t; break; } } }
    if (education) { chosen.push(education); traitSpent += education.cost; }
    const edu = eduInfo(education);

    // reserve part of the budget for skills so traits don't consume everything
    const eduCost = education ? education.cost : 0;
    const skillReserve = capOn ? Math.floor(Math.max(0, cap - aCost - eduCost) * (0.18 + Math.random() * 0.3)) : 0;
    const traitBudget = () => capOn ? cap - aCost - traitSpent - skillReserve : Infinity;
    const tryAddTrait = (t) => {
      if (!t || conflictsAny(t, chosen)) return false;
      if (t.cost > traitBudget()) return false;
      chosen.push(t); traitSpent += t.cost; return true;
    };

    // 2) personality — softly bias toward the focus skill (weighted-random, not a fixed
    //    pick). Applies to every focus; when the trait isn't taken, the freed budget lets
    //    the already-boosted focus skill carry the points instead.
    let want = 1; while (want < 3 && Math.random() < 0.65) want++;
    let persPool = focusOrder(shuffle(byCat("personality")), focus);
    let added = 0;
    for (const t of persPool) { if (added >= want) break; if (tryAddTrait(t)) added++; }

    // 3) extra categories — same soft focus bias (weighted-random, not a fixed pick),
    //    so a focus doesn't always add the single best lifestyle/other trait either.
    let extraPool = focusOrder(shuffle(pool.filter(t => extraCats.has(t.category))), focus);

    if (minPts > 0) {
      const climbers = extraPool.filter(t => t.cost > 0).sort((a,b) => b.cost - a.cost);
      let guard = 0;
      // temporary total estimate ignores skills here; refined by skill fill below
      while (aCost + traitSpent < minPts && guard < climbers.length * 2) {
        guard++;
        const affordable = climbers.filter(t => !chosen.includes(t) && !conflictsAny(t, chosen) && t.cost <= traitBudget());
        if (!affordable.length) break;
        tryAddTrait(affordable[0]);
      }
    }
    let flavor = minPts > 0 ? (Math.random() < 0.4 ? 1 : 0) : (1 + (Math.random() < 0.35 ? 1 : 0));
    for (const t of extraPool) {
      if (flavor <= 0) break;
      if (chosen.includes(t)) continue;
      if (Math.random() < 0.7 && tryAddTrait(t)) flavor--;
    }

    // 4) skills — base = displayed - trait modifiers; cost = table[base] from 0
    const mods = skillModsOf(chosen);
    const skills = SKILLS.map(s => {
      const key = s[0], label = s[1], prow = s[2];
      let target = rollDisplay();
      if (focus === key) target = 12 + rand(5);                 // focus skill 12..16
      if (key === edu.skill && edu.bonus > target) target = edu.bonus; // education floor
      const base = Math.max(0, target - (mods[key] || 0));
      return { key, label, prow, base, mod: mods[key] || 0 };
    });
    const displayed = (s) => s.base + s.mod;
    const skillTotal = () => skills.reduce((a, s) => a + tableCost(s.base, s.prow), 0);

    // trim skills to fit the remaining budget (reduce highest base first)
    if (capOn) {
      const remaining = cap - aCost - traitSpent;
      let guard = 0;
      while (skillTotal() > remaining && guard < 800) {
        guard++;
        const cand = skills.filter(s => s.base > 0).sort((a,b) => b.base - a.base)[0];
        if (!cand) break;
        cand.base--;
      }
    }
    const skCost = skillTotal();

    // culture / faith / gender
    let culture;
    if ($("cultureLock").checked) culture = BY_CULTURE[$("cultureSel").value] || pick(DATA.cultures);
    else { culture = pick(DATA.cultures); $("cultureSel").value = culture.id; }
    let faith;
    if ($("faithLock").checked) faith = BY_FAITH[$("faithSel").value] || pick(DATA.faiths);
    else { faith = pick(DATA.faiths); $("faithSel").value = faith.id; }
    const gender = Math.random() < 0.5 ? "Male" : "Female";

    render({ chosen, skills, displayed, skCost, traitSpent, aCost, age, gender, culture, faith,
             eduSkill: edu.skill, eduBonus: edu.bonus, focus, capOn, ageOn, cap, minPts,
             total: aCost + traitSpent + skCost });
  }

  // ---------- render ----------
  function costTag(c) {
    const cls = c > 0 ? "pos" : c < 0 ? "neg" : "zero";
    return '<span class="tcost '+cls+'">'+(c>0?"+":"")+c+' pts</span>';
  }
  function modLine(t) {
    const m = t.modifiers || {};
    const keys = Object.keys(m);
    if (!keys.length) return "";
    const parts = keys.slice(0, 6).map(k => (m[k]>0?"+":"")+m[k]+" "+k.replace(/_/g," "));
    return '<span class="tmods">'+parts.join(" · ")+(keys.length>6?" …":"")+'</span>';
  }
  function skillCostCls(c){ return c > 0 ? "pos" : c < 0 ? "neg" : "zero"; }

  function render(r) {
    $("result").hidden = false;
    $("charTitle").textContent = 'Random Ruler'
      + (r.focus ? ' · ' + r.focus.charAt(0).toUpperCase() + r.focus.slice(1) + ' focus' : '');
    $("charMeta").innerHTML =
      r.gender + " · Age <strong>" + r.age + "</strong>" +
      (r.ageOn ? ' <span class="dim">(' + r.aCost + " pts)</span>" : "");

    $("skillGrid").innerHTML = r.skills.map(s => {
      const disp = r.displayed(s);
      const c = tableCost(s.base, s.prow);
      const isEdu = s.key === r.eduSkill && r.eduBonus > SKILL_MIN_DISPLAY;
      const isFocus = s.key === r.focus;
      const icon = SKILL_ICONS[s.key] || "ph-star";
      const tip = "base " + s.base + (s.mod ? " + traits " + (s.mod>0?"+":"") + s.mod : "");
      const badge = isFocus ? ' <i class="ph ph-crosshair" title="Focus"></i>'
                  : isEdu   ? ' <i class="ph ph-graduation-cap" title="Education"></i>' : '';
      return '<div class="skill' + (isFocus ? ' focus' : isEdu ? ' edu' : '') + '" title="' + tip + '">'
        + '<div class="sleft"><span class="sicon"><i class="ph ' + icon + '"></i></span>'
        + '<div><div class="sname">' + s.label + badge + '</div>'
        + '<div class="squal">' + skillQuality(disp) + '</div></div></div>'
        + '<div class="sright"><div class="sval">' + disp + '</div>'
        + '<div class="spts">' + (c>0?"+":"") + c + ' pts</div></div></div>';
    }).join("");

    const cv = $("cultureVal");
    cv.querySelector(".cf-name").textContent = r.culture.name;
    cv.querySelector(".cf-sub").textContent = prettyHeritage(r.culture.heritage);
    const fv = $("faithVal");
    fv.querySelector(".cf-name").textContent = r.faith.name;
    fv.querySelector(".cf-sub").textContent = r.faith.religion || "";

    const total = r.total;
    $("ptUsed").textContent = total;
    $("ptCap").textContent = r.capOn ? r.cap : "∞";
    const pct = r.capOn ? Math.min(100, (total / r.cap) * 100) : Math.min(100, total / 6);
    const fill = $("barFill");
    fill.style.width = pct + "%";
    fill.classList.toggle("over", r.capOn && total > r.cap);
    const rem = r.cap - total;
    $("ptRemaining").innerHTML = r.capOn
      ? (rem >= 0 ? rem + " points remaining (banked)" : '<span style="color:var(--red)">' + (-rem) + " over the limit!</span>")
      : "no limit (achievements off)";
    $("ptBreakdown").textContent =
      "Age " + r.aCost + " · Skills " + r.skCost + " · Traits " + r.traitSpent;

    const box = $("traitGroups"); box.innerHTML = "";
    CAT_ORDER.forEach(cat => {
      const items = r.chosen.filter(t => t.category === cat);
      if (!items.length) return;
      const g = document.createElement("div");
      const header = '<div class="sec"><h3>' + (CAT_LABELS[cat] || cat) + '</h3><span class="rule"></span></div>';
      const icon = CAT_ICONS[cat] || "ph-seal";
      const rows = items.map(t => {
        const eff = effText(t);
        const dlc = t.dlc ? '<span class="tdlc"><i class="ph ph-package"></i> ' + t.dlc + '</span>' : '';
        const meta = eff && dlc ? eff + ' · ' + dlc : (eff || dlc);
        return '<div class="trait"><span class="ticon"><i class="ph ' + icon + '"></i></span>'
          + '<div class="tbody"><div class="thead">'
          + '<span class="tname">' + t.name + '</span>'
          + '<span class="tpts">' + (t.cost > 0 ? "+" : "") + t.cost + ' pts</span></div>'
          + (meta ? '<div class="teff">' + meta + '</div>' : '')
          + '</div></div>';
      }).join("");
      g.innerHTML = header + rows;
      box.appendChild(g);
    });

    const w = $("warn"); let msg = "";
    if (r.capOn && total > r.cap)
      msg = "⚠️ This character exceeds 400 points and would NOT be valid for achievements.";
    else if (r.minPts > 0 && total < r.minPts)
      msg = "⚠️ Could not reach " + r.minPts + " pts with the active categories/DLCs (reached " + total + ").";
    w.hidden = !msg; w.textContent = msg;
  }

  // ---------- boot ----------
  let BY_CULTURE = {}, BY_FAITH = {};
  function boot() {
    $("ptCap").textContent = DATA.config.point_cap;
    $("dataMeta").textContent =
      DATA._meta.counts.traits + " traits · " + DATA._meta.counts.cultures + " cultures · " + DATA._meta.counts.faiths +
      " faiths · data extracted from Crusader Kings III base game files";

    DATA.cultures.forEach(c => BY_CULTURE[c.id] = c);
    DATA.faiths.forEach(f => BY_FAITH[f.id] = f);
    fillSelect($("cultureSel"), DATA.cultures);
    fillSelect($("faithSel"), DATA.faiths);

    const dlcs = [...new Set(TRAITS.map(t => t.dlc).filter(Boolean))].sort();
    const dlcBox = $("dlcList");
    dlcs.forEach(name => {
      const n = TRAITS.filter(t => t.dlc === name).length;
      dlcBox.appendChild(makeChip("dlc", name, name, n, true));
    });
    if (!dlcs.length) dlcBox.innerHTML = '<span class="hint">No traits with an identified DLC.</span>';
    $("dlcAll").onclick = () => dlcBox.querySelectorAll("input").forEach(i => setChip(i, true));
    $("dlcNone").onclick = () => dlcBox.querySelectorAll("input").forEach(i => setChip(i, false));

    const catBox = $("catList");
    EXTRA_CATS.forEach(pair => {
      const id = pair[0], label = pair[1];
      const n = TRAITS.filter(t => t.category === id).length;
      if (!n) return;
      catBox.appendChild(makeChip("cat", id, label, n, DEFAULT_EXTRA.has(id)));
    });

    const mp = $("minPoints");
    const syncMin = () => { $("minPointsVal").textContent = mp.value; };
    mp.addEventListener("input", syncMin); syncMin();

    // Lock buttons (design uses <button> instead of a checkbox). We toggle a
    // .locked class for styling and mirror it onto b.checked, so generate()'s
    // existing $("...Lock").checked reads keep working unchanged.
    ["cultureLock", "faithLock", "ageLock"].forEach(id => {
      const b = $(id); if (!b) return;
      b.checked = false;
      b.addEventListener("click", () => {
        const on = b.classList.toggle("locked");
        b.checked = on;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        const i = b.querySelector("i");
        if (i) i.className = "ph " + (on ? "ph-lock" : "ph-lock-open");
      });
    });

    $("generate").onclick = generate;
    generate();
  }

  function useData(d) { DATA = d; TRAITS = d.traits; TRAITS.forEach(t => BY_ID[t.id] = t); boot(); }
  if (window.CK3_DATA) {
    useData(window.CK3_DATA);
  } else {
    fetch("data.json").then(r => r.json()).then(useData).catch(e => {
      document.body.innerHTML =
        '<p style="padding:2rem;color:#e8b3aa;font-family:sans-serif">Failed to load data: ' + e +
        ' &mdash; if you opened by double-click, serve over HTTP with <code>python3 -m http.server</code> and visit localhost:8000.</p>';
    });
  }
})();
