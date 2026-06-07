import { env } from "@/backend/config/env";

export function browserUseRecipe(task: string, model?: string) {
  return [
    "import asyncio",
    "import os",
    "import time",
    "from browser_use import Agent, BrowserSession",
    "from browser_use.llm import ChatOpenAI",
    "from novita_sandbox.code_interpreter import Sandbox",
    "",
    "async def main():",
    "    sandbox = Sandbox(timeout=600, template='browser-chromium')",
    "    try:",
    "        host = sandbox.get_host(9223)",
    "        browser_session = BrowserSession(cdp_url=f'https://{host}')",
    "        await browser_session.start()",
    "        agent = Agent(",
    `            task=${JSON.stringify(task)},`,
    "            llm=ChatOpenAI(",
    "                api_key=os.environ['LLM_API_KEY'],",
    "                base_url=os.getenv('LLM_BASE_URL', 'https://api.novita.ai/openai'),",
    `                model=os.getenv('LLM_MODEL', ${JSON.stringify(model || env.defaultModel)}),`,
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
