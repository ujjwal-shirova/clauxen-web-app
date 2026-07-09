import type { Message } from "@/frontend/lib/types";

/** One user→assistant exchange in the continuous login demo chat. */
export type DemoTurn = {
  id: string;
  prompt: string;
  reply: string;
};

/**
 * Continuous conversation — 5 OpenAI-style pairs across Hindi, English,
 * Chinese, Japanese, and English (parenting + budgeting + light code).
 */
export const DEMO_CHAT_TURNS: DemoTurn[] = [
  {
    id: "t1",
    prompt:
      "नमस्ते, मैं एक छोटी सी किराने की दुकान चलाता हूँ और घर का खर्च चलाना अब मुश्किल हो रहा है। ऊपर से मेरी बेटी 10 साल की है, वो स्कूल से आने के बाद टीवी और मोबाइल में समय बर्बाद करती है, पढ़ाई में बिलकुल मन नहीं लगाती। कृपया बताइए कि मैं परिवार को आर्थिक रूप से कैसे बेहतर सहारा दूँ, और बेटी की पढ़ाई कैसे सुधारूं?",
    reply:
      "देखिए, ताकि मैं आपको सबसे स्पष्ट और काम आने वाला जवाब दे सकूँ, इसे दो हिस्सों में समझते हैं — पहले आमदनी/खर्च, फिर बेटी की पढ़ाई।\n\n**1) घर की आर्थिक स्थिति सुधारने के लिए (छोटे, तुरंत शुरू होने वाले कदम)**\n- **होम-डिलीवरी शुरू करें:** WhatsApp Business पर आस-पास के ग्राहकों को रोज़/साप्ताहिक लिस्ट भेजें (दूध, आटा, तेल, सब्ज़ी)। बिना नई दुकान खोले बिक्री बढ़ती है।\n- **एक पेज का बजट बनाएँ:** तीन कॉलम — *कमाई*, *ज़रूरी खर्च* (राशन, किराया/बिजली, स्कूल फीस), *बचत*। हर रविवार रात 10 मिनट में अपडेट करें। पता चलेगा पैसा कहाँ फिसल रहा है।\n- **मार्जिन वाले आइटम बढ़ाएँ:** कम मुनाफ़े वाली चीज़ों के साथ पैक्ड स्नैक्स, साबुन, चाय-चीनी जैसे तेज़-बिकने वाले आइटम रखें।\n- **सरकारी/स्थानीय मदद जाँचें:** मुद्रा लोन, जन धन से जुड़ी बचत, और स्थानीय सहकारी समिति — दुकान स्टॉक बढ़ाने में मदद मिल सकती है। बैंक में एक बार पूछ लें, फॉर्म अक्सर आसान होते हैं।\n\n**2) बेटी की पढ़ाई और स्क्रीन टाइम**\n- **नियम, सज़ा नहीं:** स्कूल से आने के बाद पहले 45–60 मिनट — नाश्ता + होमवर्क। उसके *बाद* ही टीवी/मोबाइल (टाइमर लगाकर 30–40 मिनट)।\n- **DIKSHA ऐप** पर उसकी कक्षा के वीडियो + अभ्यास — मुफ़्त और पाठ्यक्रम से जुड़ा।\n- **रोज़ 10 मिनट साथ बैठें:** कोई भी किताब/पाठ — आप सुनें, वो पढ़े। ध्यान और आपका जुड़ाव दोनों बढ़ते हैं।\n- **छोटी जीत पर शाबाशी:** सही जवाब, पूरा होमवर्क, या बिना याद दिलाए पढ़ना शुरू करना — तारीफ़ से आदत मजबूत होती है।\n\n**इस हफ़्ते सिर्फ़ ये 3 काम करें:** (1) WhatsApp पर 10 पुराने ग्राहकों को डिलीवरी मैसेज, (2) एक पेज बजट, (3) शाम 6–7 बजे पढ़ाई का ब्लॉक।\n\nचाहें तो मैं आपके परिवार के समय के हिसाब से एक सिंपल साप्ताहिक टाइम-टेबल भी बना दूँ।",
  },
  {
    id: "t2",
    prompt:
      "Hi, my husband and I both work full-time and our 10-year-old daughter is falling behind in reading and math. We're also trying to save for her college fund, but with rent going up every year it's really tight. Can you help us figure out a routine for her and some practical budgeting tips for us?",
    reply:
      "You know, so I can give you something really thorough and useful, let's go through this properly — money first (because stress leaks into everything), then a routine you can actually keep on weeknights.\n\n**Budgeting when rent keeps climbing**\n- Start with a **needs / wants / future** split (a flexible 50/30/20). If rent alone is over ~35% of take-home, treat that as a signal: negotiate renewal, ask about a longer lease lock, or plan a move *before* you're forced into a bad one.\n- Automate a **tiny college transfer** the day after payday — even $40–75/month into a 529 (or your country's equivalent). Consistency beats waiting for a \"good month.\" Many plans also have a state tax perk.\n- Build a **$500–1,000 starter emergency buffer** before aggressive investing. One car repair shouldn't wipe out college savings.\n- Do a 20-minute **subscription + grocery audit** once a month. Cancel one unused service; switch one recurring grocery to store brand. Boring, but it funds the 529.\n\n**A catch-up routine that fits two full-time jobs**\n- **Right after school (before screens):** 20 minutes reading *she* chooses + 15 minutes math on one weak skill — not \"all homework forever.\"\n- Ask her teacher for the **2–3 skills** she's behind on. Targeted practice beats vague \"help with math.\"\n- Use adaptive free/cheap tools: **Khan Academy** (or Kids) and a leveled reader list from the school librarian.\n- Put a **simple star chart** on the fridge (reading done / math done). You glance; she owns the checkmarks.\n\n**Sample weeknight (30–35 min total)**  \nSnack → 20 min reading together → 15 min math → then free time. Weekends: one longer review if a test is coming.\n\nIf you share her grade level and roughly what rent takes of income, I can tighten both the budget numbers and a printable weekday schedule for you two.",
  },
  {
    id: "t3",
    prompt:
      "你好,我和我爱人经常要加班到晚上九点多才能到家,孩子读四年级,数学成绩一直不太好,我们平时根本没时间辅导她。另外我想自己写一个简单的Python小工具来记录家里每个月的开支,能不能给点建议,顺便帮我写一下代码?",
    reply:
      "你知道,为了给你最详细、也最能落地的建议,我们分两块说:先解决\"没时间辅导数学\",再给你一个能直接用的记账小工具。\n\n**加班多、怎么帮四年级数学**\n- **少而稳,比多而累强:** 固定每周 3 次、每次 20 分钟\"专注小课堂\"(比如周二/四/日)。疲惫时硬陪一小时,效果往往更差。\n- **先自学、后检查:** 让她用洋葱数学或学校推荐的练习 App 先过概念;你们到家后只问三句——今天练了什么?哪题不会?卡在哪一步?你们当\"教练\",不是全职老师。\n- **把监督交给接送的人:** 和爷爷奶奶说清楚:负责看着作业写完、对答案,不负责讲题,压力会小很多。\n- **找薄弱点:** 周末花 10 分钟看错题本,只盯 1–2 个知识点(比如分数、应用题),比盲目刷卷有效。\n\n**家庭开支记账(Python)**  \n下面这个版本会按月汇总,并标出本月总支出:\n\n```python\nimport json\nfrom datetime import date\nfrom collections import defaultdict\n\nFILE = \"expenses.json\"\n\ndef load():\n    try:\n        with open(FILE, \"r\", encoding=\"utf-8\") as f:\n            return json.load(f)\n    except FileNotFoundError:\n        return []\n\ndef save(data):\n    with open(FILE, \"w\", encoding=\"utf-8\") as f:\n        json.dump(data, f, ensure_ascii=False, indent=2)\n\ndef add_expense(amount, category, note=\"\"):\n    data = load()\n    data.append({\n        \"date\": str(date.today()),\n        \"amount\": float(amount),\n        \"category\": category,\n        \"note\": note,\n    })\n    save(data)\n    print(f\"已记录: {category} {amount} 元\")\n\ndef summary(month=None):\n    \"\"\"month 形如 '2026-07';默认本月\"\"\"\n    if month is None:\n        month = date.today().strftime(\"%Y-%m\")\n    data = load()\n    totals = defaultdict(float)\n    for item in data:\n        if item[\"date\"].startswith(month):\n            totals[item[\"category\"]] += item[\"amount\"]\n    if not totals:\n        print(f\"{month} 暂无记录\")\n        return\n    print(f\"=== {month} 支出汇总 ===\")\n    for cat, total in sorted(totals.items(), key=lambda x: -x[1]):\n        print(f\"{cat}: {total:.2f} 元\")\n    print(f\"合计: {sum(totals.values()):.2f} 元\")\n\n# 示例\nadd_expense(35.5, \"餐饮\", \"晚饭外卖\")\nadd_expense(120, \"教育\", \"数学练习册\")\nsummary()\n```\n\n建议类别先固定成:餐饮、教育、房租、交通、日用——月底一眼能看出哪块超了。\n\n如果你愿意,我可以再帮你加\"按周提醒\"或一个最简单的图形界面(tkinter)。",
  },
  {
    id: "t4",
    prompt:
      "こんにちは。残業が多くて、10歳の娘との勉強時間があまり取れません。塾に通わせる余裕もあまりなくて悩んでいます。あと、家計簿をつけるための簡単なPythonのコードも教えてもらえますか?",
    reply:
      "ご存知の通り、できるだけ詳しく・すぐ使える形でお伝えしたいので、学習サポートと家計簿を分けてご説明しますね。\n\n**残業が多い中での学習サポート**\n- **毎日じゃなくて大丈夫。** 週3回・各20分の「集中学習タイム」をカレンダーに先に入れておくと、疲れている日でも続けやすいです。\n- **塾の代わりになる選択肢:** 「すらら」「スタディサプリ」などは、費用を抑えつつ自分のペースで進められます。まずは無料体験で合うか見てみてください。\n- **教えなくても価値がある関わり:** 宿題の丸つけ・「どこが分からなかった?」の一言だけでも、「見てもらえている」安心感につながります。\n- **スクリーンの順番を決める:** 帰宅後は「宿題 → 自由時間」。逆だと勉強が後回しになりがちです。\n\n**家計簿の簡単なPythonコード**  \nカテゴリ別合計に加えて、今月の総額も出します:\n\n```python\nimport json\nfrom datetime import date\nfrom collections import defaultdict\n\nFILE = \"kakeibo.json\"\n\ndef load():\n    try:\n        with open(FILE, \"r\", encoding=\"utf-8\") as f:\n            return json.load(f)\n    except FileNotFoundError:\n        return []\n\ndef save(data):\n    with open(FILE, \"w\", encoding=\"utf-8\") as f:\n        json.dump(data, f, ensure_ascii=False, indent=2)\n\ndef add_expense(amount, category, memo=\"\"):\n    data = load()\n    data.append({\n        \"date\": str(date.today()),\n        \"amount\": int(amount),\n        \"category\": category,\n        \"memo\": memo,\n    })\n    save(data)\n\ndef show_summary(month=None):\n    if month is None:\n        month = date.today().strftime(\"%Y-%m\")\n    data = load()\n    totals = defaultdict(int)\n    for item in data:\n        if item[\"date\"].startswith(month):\n            totals[item[\"category\"]] += item[\"amount\"]\n    print(f\"=== {month} の支出 ===\")\n    for cat, total in sorted(totals.items(), key=lambda x: -x[1]):\n        print(f\"{cat}: {total:,}円\")\n    print(f\"合計: {sum(totals.values()):,}円\")\n\n# 使用例\nadd_expense(2500, \"食費\", \"スーパー\")\nadd_expense(8000, \"教育\", \"通信教材\")\nshow_summary()\n```\n\nまずは「食費・教育・住居・交通・その他」の5カテゴリだけで十分です。月末に `show_summary()` を一度走らせる習慣にすると、塾や教材の判断もしやすくなります。\n\nグラフ化(matplotlib)や、スマホから打ちやすい形にもできますので、必要なら続きもお作りします。",
  },
  {
    id: "t5",
    prompt:
      "I'm a single mom working two jobs and honestly exhausted most days. My daughter just turned 10 and I want her to start managing her own allowance and build better study habits, but I don't have much time to sit with her every day. Could you suggest a simple routine, and maybe write me some basic code to track her chores and allowance?",
    reply:
      "You know, so I can give you something really thorough and useful — and respectful of how little spare energy you have — let's design a system she mostly runs herself, with you only doing a quick nightly check.\n\n**A routine that doesn't need you sitting beside her**\n- **Fridge chart, three boxes max:** make bed · homework done · one help-chore (dishes/trash). She checks them off; you glance for 10 seconds at bedtime.\n- **Allowance = whole chart complete**, not per-chore micromanagement. Fixed weekly amount (whatever you can afford) teaches responsibility without turning you into a payroll clerk after a double shift.\n- **One 15-minute study block right after school** — before TV/games. Short and early beats a doomed \"we'll study after dinner\" plan when you're wiped.\n- **Semi-independent apps** (Prodigy, Khan Academy, a reading app she likes) so learning still happens on days you genuinely can't sit with her.\n- **Sunday 10-minute reset together:** look at the chart, celebrate what worked, set one focus for the week. That's your \"sit with her\" time — protected and small.\n\n**Chore + allowance tracker (Python)**  \nTracks a full week, not just today:\n\n```python\nimport json\nfrom datetime import date, timedelta\n\nFILE = \"chores.json\"\nWEEKLY_ALLOWANCE = 10.0\nREQUIRED = (\"bed\", \"homework\", \"dishes\")\n\ndef load():\n    try:\n        with open(FILE, \"r\", encoding=\"utf-8\") as f:\n            return json.load(f)\n    except FileNotFoundError:\n        return {\"days\": {}}\n\ndef save(data):\n    with open(FILE, \"w\", encoding=\"utf-8\") as f:\n        json.dump(data, f, indent=2)\n\ndef mark_done(chore, day=None):\n    data = load()\n    key = str(day or date.today())\n    done = data[\"days\"].setdefault(key, [])\n    if chore not in done:\n        done.append(chore)\n        save(data)\n    print(f\"{key}: {', '.join(data['days'][key])}\")\n\ndef week_days(end=None):\n    end = end or date.today()\n    start = end - timedelta(days=end.weekday())  # Monday\n    return [start + timedelta(days=i) for i in range(7)]\n\ndef days_complete(end=None):\n    data = load()\n    ok = 0\n    for d in week_days(end):\n        done = data[\"days\"].get(str(d), [])\n        if all(c in done for c in REQUIRED):\n            ok += 1\n    return ok\n\ndef pay_if_ready(need_days=5):\n    n = days_complete()\n    if n >= need_days:\n        print(f\"Nice work — {n}/7 solid days. Allowance: ${WEEKLY_ALLOWANCE:.2f}\")\n    else:\n        print(f\"{n}/{need_days} complete days so far. Keep going — you've got this.\")\n\n# Example\nmark_done(\"bed\")\nmark_done(\"homework\")\nmark_done(\"dishes\")\npay_if_ready()\n```\n\nShe runs `mark_done(...)`; you run `pay_if_ready()` on payday. Requiring 5 of 7 days keeps the bar high but human — sick days and chaos weeks won't erase everything.\n\nIf you want, I can turn this into a one-page printable chart with the same three chores and a checkbox grid for the week.",
  },
];

export function buildUserMessage(turn: DemoTurn, index: number): Message {
  return {
    id: `demo-user-${turn.id}-${index}`,
    role: "user",
    content: turn.prompt,
    createdAt: Date.now(),
  };
}

export function buildAssistantMessage(
  turn: DemoTurn,
  index: number,
  content: string,
  isStreaming: boolean,
  createdAt = Date.now(),
): Message {
  return {
    id: `demo-assistant-${turn.id}-${index}`,
    role: "assistant",
    content,
    isStreaming,
    createdAt,
  };
}
