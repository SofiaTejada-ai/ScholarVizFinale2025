import os
from openai import OpenAI
import google.generativeai as genai

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

gpt_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel("gemini-2.5-pro")
else:
    gemini_model = None


def ask_gpt(prompt: str, user_prompt: str | None = None) -> str:
    if not OPENAI_API_KEY or gpt_client is None:
        return "(GPT: OPENAI_API_KEY not set)"
    try:
        if user_prompt is None:
            input_data = prompt
        else:
            input_data = [
                {"role": "system", "content": prompt},
                {"role": "user", "content": user_prompt},
            ]
        resp = gpt_client.responses.create(
            model="gpt-4.1-mini",
            input=input_data,
        )
        return resp.output[0].content[0].text
    except Exception as e:
        return f"(GPT error: {e})"


def ask_gemini(prompt: str) -> str:
    if not GEMINI_API_KEY or gemini_model is None:
        return "(Gemini: GEMINI_API_KEY not set)"
    try:
        resp = gemini_model.generate_content(prompt)
        return resp.text
    except Exception as e:
        return f"(Gemini error: {e})"
