#!/usr/bin/env python3
"""CK3 Ruler Designer data extractor -> data.json"""
import re, json, glob, os, sys
GAME = sys.argv[1] if len(sys.argv) > 1 else "."
OUT  = sys.argv[2] if len(sys.argv) > 2 else "data.json"
def gpath(*p): return os.path.join(GAME, *p)
def read(path): return open(path, encoding="utf-8-sig").read()

def top_level_blocks(text):
    lines = text.split("\n"); i = 0
    while i < len(lines):
        m = re.match(r'^([A-Za-z_][\w]*)\s*=\s*\{', lines[i])
        if m:
            name=m.group(1); depth=0; buf=[]
            for j in range(i,len(lines)):
                buf.append(lines[j]); depth+=lines[j].count("{")-lines[j].count("}")
                if depth<=0 and j>i: break
            yield name, "\n".join(buf); i=j+1
        else: i+=1

def top_level_blocks_indented(text):
    lines=text.split("\n"); i=0
    while i<len(lines):
        m=re.match(r'^\s*([A-Za-z_][\w]*)\s*=\s*\{', lines[i])
        if m:
            name=m.group(1); depth=0; buf=[]
            for j in range(i,len(lines)):
                buf.append(lines[j]); depth+=lines[j].count("{")-lines[j].count("}")
                if depth<=0 and j>i: break
            yield name, "\n".join(buf); i=j+1
        else: i+=1

def field(block,name):
    m=re.search(rf'(^|\n)\s*{name}\s*=\s*([^\s#{{]+)', block); return m.group(2) if m else None

def load_loc(*globs):
    loc={}
    for g in globs:
        for f in glob.glob(g):
            try:
                for line in open(f, encoding="utf-8-sig"):
                    m=re.match(r'\s*([A-Za-z0-9_.]+):\d*\s*"(.*)"', line)
                    if m and m.group(1) not in loc: loc[m.group(1)]=m.group(2)
            except Exception: pass
    return loc

def clean_name(s):
    if s is None: return None
    s=re.sub(r'#\S+ ','',s).replace('#!','')
    s=re.sub(r'\[[^\]]*\]','',s); s=re.sub(r'\$[^$]*\$','',s); s=re.sub(r'@\w+!','',s)
    return s.strip()

trait_loc=load_loc(gpath("localization/english/traits_l_english.yml"))
def trait_name(tid):
    for k in (f"trait_{tid}", tid):
        if k in trait_loc: return clean_name(trait_loc[k]) or tid
    return tid

DLC_MAP={
 "adventurer":"Roads to Power","adventurer_follower":"Roads to Power","knight_errant":"Roads to Power",
 "peasant_leader":"Roads to Power","populist_leader":"Roads to Power",
 "governor":"All Under Heaven","confucian_education":"All Under Heaven",
 "lifestyle_wayfarer":"Wandering Nobles","lifestyle_voyager":"Wandering Nobles","lifestyle_surveyor":"Wandering Nobles",
 "lifestyle_traveler":"Tours and Tournaments","journaller":"Tours and Tournaments","tourney_participant":"Tours and Tournaments",
}
NON_MODIFIER={"level","ruler_designer_cost","minimum_age","birth","random_creation",
 "random_creation_weight","domain_limit","physical","good","genetic"}
def is_modifier_key(k):
    if k in NON_MODIFIER: return False
    if k.startswith("ai_") or k.startswith("genetic_constraint"): return False
    if k.endswith("_weight"): return False
    return True
def modifiers(block):
    depth=1; out={}
    for ln in block.split("\n")[1:]:
        d0=depth; depth+=ln.count("{")-ln.count("}")
        if d0==1:
            m=re.match(r'\s*([a-z_][\w]*)\s*=\s*(-?\d+\.?\d*)\s*(#.*)?$', ln)
            if m and is_modifier_key(m.group(1)):
                v=m.group(2); out[m.group(1)]=float(v) if "." in v else int(v)
    return out
def opposites(block):
    m=re.search(r'opposites\s*=\s*\{([^}]*)\}', block); return m.group(1).split() if m else []
def category_of(block):
    if re.search(r'(^|\n)\s*genetic\s*=\s*yes', block): return "congenital"
    return field(block,"category") or "other"

traits_txt=read(gpath("common/traits/00_traits.txt")); traits=[]
for name,block in top_level_blocks(traits_txt):
    if not re.search(r'(^|\n)\s*ruler_designer_cost\s*=', block): continue
    if re.search(r'shown_in_ruler_designer\s*=\s*no', block): continue
    cost_raw=field(block,"ruler_designer_cost"); lvl=field(block,"level")
    traits.append({"id":name,"name":trait_name(name),"category":category_of(block),
      "cost":int(cost_raw) if cost_raw is not None and re.match(r'-?\d+$',cost_raw) else None,
      "opposites":opposites(block),"group":field(block,"group"),
      "level":int(lvl) if lvl and re.match(r'-?\d+$',lvl) else None,
      "modifiers":modifiers(block),"dlc":DLC_MAP.get(name)})

defines=read(gpath("common/defines/00_defines.txt"))
rd=re.search(r'NRulerDesigner\s*=\s*\{(.*?)\n\}', defines, re.S).group(1)
def nums(fn,text=rd):
    m=re.search(rf'{fn}\s*=\s*\{{([^}}]*)\}}', text)
    return [float(x) if "." in x else int(x) for x in m.group(1).split()] if m else None
def num(fn,text=rd):
    m=re.search(rf'{fn}\s*=\s*([-\d.]+)', text)
    if not m: return None
    v=m.group(1); return float(v) if "." in v else int(v)
age_levels=nums("AGE_LEVELS"); age_mults=nums("AGE_LEVEL_MULTIPLIERS")
def gband(v):
    if v<=0:return 0
    if v<=4:return 2*v
    if v<=8:return 4*(v-4)+8
    if v<=12:return 7*(v-8)+24
    if v<=16:return 11*(v-12)+52
    return 17*(v-16)+96
def pband(v):
    if v<=0:return 0
    if v<=4:return 1*v
    if v<=8:return 2*(v-4)+4
    if v<=12:return 4*(v-8)+12
    if v<=16:return 7*(v-12)+28
    return 11*(v-16)+56
config={"point_cap":num("IRONMAN_POINT_MAX"),"default_skill_value":num("DEFAULT_SKILL_VALUE"),
 "base_health":num("BASE_HEALTH"),"default_education_trait":(field(rd,"DEFAULT_EDUCATION_TRAIT") or "").strip('"'),
 "attribute_costs":{"_note":"Marginal point cost to raise a skill TO value v. Skills default to 5 (free); below 5 refunds.",
   "general":{"bands":[{"min":1,"max":4,"formula":"2*v"},{"min":5,"max":8,"formula":"4*(v-4)+8"},
     {"min":9,"max":12,"formula":"7*(v-8)+24"},{"min":13,"max":16,"formula":"11*(v-12)+52"},
     {"min":17,"max":None,"formula":"17*(v-16)+96"}],"table":{str(v):gband(v) for v in range(0,21)}},
   "prowess":{"bands":[{"min":1,"max":4,"formula":"1*v"},{"min":5,"max":8,"formula":"2*(v-4)+4"},
     {"min":9,"max":12,"formula":"4*(v-8)+12"},{"min":13,"max":16,"formula":"7*(v-12)+28"},
     {"min":17,"max":None,"formula":"11*(v-16)+56"}],"table":{str(v):pband(v) for v in range(0,21)}}},
 "age_curve":{"_note":"Points spent on age = round(age*multiplier). Use first AGE_LEVELS[i]>=age.",
   "age_levels":age_levels,"multipliers":age_mults}}

culture_loc=load_loc(gpath("localization/english/culture/cultures_l_english.yml"))
cultures=[]
for f in sorted(glob.glob(gpath("common/culture/cultures/*.txt"))):
    for name,block in top_level_blocks(read(f)):
        if not re.search(r'(^|\n)\s*heritage\s*=', block): continue
        cultures.append({"id":name,"name":clean_name(culture_loc.get(name,name)) or name,
          "heritage":field(block,"heritage")})
seen=set(); cultures=[c for c in cultures if not (c["id"] in seen or seen.add(c["id"]))]

faith_loc=load_loc(gpath("localization/english/religion/*.yml"))
faiths=[]
def find_faiths(block,rid,rname,out):
    m=re.search(r'\n(\s*)faiths\s*=\s*\{', block)
    if not m: return
    start=m.end(); depth=1; i=start
    while i<len(block) and depth>0:
        if block[i]=="{":depth+=1
        elif block[i]=="}":depth-=1
        i+=1
    inner=block[start:i-1]
    for fname,_ in top_level_blocks_indented(inner):
        out.append({"id":fname,"name":clean_name(faith_loc.get(fname,fname)) or fname,
          "religion":rname,"religion_id":rid})
for f in sorted(glob.glob(gpath("common/religion/religion_types/*.txt"))):
    for rname,rblock in top_level_blocks(read(f)):
        rdisp=clean_name(faith_loc.get(rname,rname)) or rname
        find_faiths(rblock,rname,rdisp,faiths)
seen=set(); faiths=[x for x in faiths if not (x["id"] in seen or seen.add(x["id"]))]

data={"_meta":{"source":"Crusader Kings III base game files","generator":"parse_ck3.py",
   "trait_selection_rule":"has ruler_designer_cost AND not shown_in_ruler_designer=no",
   "counts":{"traits":len(traits),"cultures":len(cultures),"faiths":len(faiths)},
   "dlc_note":"dlc is a curated best-effort map; base 00_traits.txt carries no per-trait DLC tag. null = base game or unattributed."},
 "config":config,"traits":traits,"cultures":cultures,"faiths":faiths}
json.dump(data, open(OUT,"w",encoding="utf-8"), ensure_ascii=False, indent=2)

from collections import Counter
print("traits:",len(traits),"| by cat:",dict(Counter(t["category"] for t in traits)))
print("cost=null:",sum(1 for t in traits if t["cost"] is None),"| dlc-tagged:",sum(1 for t in traits if t["dlc"]))
print("cultures:",len(cultures),"| faiths:",len(faiths))
print("point_cap:",config["point_cap"],"| default_edu:",config["default_education_trait"])
print("sample culture:",cultures[0]); print("sample faith:",faiths[0])
