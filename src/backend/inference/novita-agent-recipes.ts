import { env } from "@/backend/config/env";

export function browserUseRecipe(task: string, model?: string) {
  const modelSlug = model || env.defaultModel;
  return [
    "import asyncio",
    "import os",
    "import time",
    "from browser_use import Agent, BrowserSession",
    "from browser_use.llm import ChatAnthropic",
    "from novita_sandbox.code_interpreter import Sandbox",
    "",
    "async def main():",
    "    sandbox = Sandbox(timeout=600, template='browser-chromium')",
    "    try:",
    "        host = sandbox.get_host(9223)",
    "        browser_session = BrowserSession(cdp_url=f'https://{host}')",
    "        await browser_session.start()",
    "        api_key = os.environ.get('Provider_API_Key') or os.environ.get('LLM_API_KEY') or os.environ.get('NOVITA_API_KEY')",
    "        base_url = os.environ.get('Provider_BASE_URL') or os.environ.get('LLM_BASE_URL') or ''",
    "        model_id = os.environ.get('Provider_Model_Clauxen_V1') or os.environ.get('LLM_MODEL') or " +
      JSON.stringify(modelSlug),
    "        agent = Agent(",
    `            task=${JSON.stringify(task)},`,
    "            llm=ChatAnthropic(",
    "                api_key=api_key,",
    "                base_url=base_url,",
    "                model=model_id,",
    "                temperature=0.6,",
    "            ),",
    "            browser_session=browser_session,",
    "        )",
    "        await agent.run()",
    "        await browser_session.close()",
    "    finally:",
    "        sandbox.kill()",
    "",
    "if __name__ == '__main__':",
    "    asyncio.run(main())",
  ].join("\n");
}

export function desktopRecipe(viewOnly: boolean) {
  return [
    "from e2b_desktop import Sandbox",
    "import time",
    "",
    "desktop = Sandbox.create()",
    "desktop.stream.start()",
    `print(desktop.stream.get_url(view_only=${viewOnly ? "True" : "False"}))`,
    "",
    "try:",
    "    while True:",
    "        time.sleep(0.2)",
    "except KeyboardInterrupt:",
    "    desktop.stream.stop()",
    "    desktop.kill()",
  ].join("\n");
}
