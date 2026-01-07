from playwright.sync_api import sync_playwright, expect
import time

# Sample plan source (taken from plan1_source in samples.ts)
PLAN_SOURCE = """Nested Loop Left Join  (cost=11.95..28.52 rows=5 width=157) (actual time=0.010..0.010 rows=0 loops=1)
  Output: rel_users_exams.user_username, rel_users_exams.exam_id, rel_users_exams.started_at, rel_users_exams.finished_at, exam_1.id, exam_1.title, exam_1.date_from, exam_1.date_to, exam_1.created, exam_1.created_by_, exam_1.duration, exam_1.success_threshold, exam_1.published
  Inner Unique: true
  Join Filter: (exam_1.id = rel_users_exams.exam_id)
  Buffers: shared hit=1
  ->  Bitmap Heap Scan on public.rel_users_exams  (cost=11.80..20.27 rows=5 width=52) (actual time=0.009..0.009 rows=0 loops=1)
        Output: rel_users_exams.user_username, rel_users_exams.exam_id, rel_users_exams.started_at, rel_users_exams.finished_at
        Recheck Cond: (1 = rel_users_exams.exam_id)
        Buffers: shared hit=1
        ->  Bitmap Index Scan on rel_users_exams_pkey  (cost=0.00..11.80 rows=5 width=0) (actual time=0.005..0.005 rows=0 loops=1)
              Index Cond: (1 = rel_users_exams.exam_id)
              Buffers: shared hit=1
  ->  Materialize  (cost=0.15..8.17 rows=1 width=105) (never executed)
        Output: exam_1.id, exam_1.title, exam_1.date_from, exam_1.date_to, exam_1.created, exam_1.created_by_, exam_1.duration, exam_1.success_threshold, exam_1.published
        ->  Index Scan using exam_pkey on public.exam exam_1  (cost=0.15..8.17 rows=1 width=105) (never executed)
              Output: exam_1.id, exam_1.title, exam_1.date_from, exam_1.date_to, exam_1.created, exam_1.created_by_, exam_1.duration, exam_1.success_threshold, exam_1.published
              Index Cond: (exam_1.id = 1)
Planning Time: 1.110 ms
Execution Time: 0.170 ms
"""

def verify_tooltip():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app (assuming default Vite port)
        page.goto("http://localhost:5173/")

        # Wait for app to load
        page.wait_for_selector(".plan-container, .card")

        # Input the plan
        # There should be a textarea or contenteditable for input
        # Based on Plan.vue, if !store.plan, it shows an error card or initial state?
        # Actually Main.vue or App.vue likely handles the initial input.
        # Let's check App.vue. But usually there's a main input area.
        # If I look at screenshot/demo, usually there is a textarea.

        # Assuming the app starts with an empty state asking for input.
        # If I'm not sure, I can try to find a textarea.
        textarea = page.locator("textarea")
        if textarea.count() > 0:
            textarea.fill(PLAN_SOURCE)
            # Find submit button
            page.get_by_role("button", name="Submit").click() # Guessing button name
        else:
            # Maybe it's a contenteditable or CodeMirror?
            # Or maybe the URL hash can handle it?
            # Looking at Plan.vue: store.parse(props.planSource, props.planQuery)
            # App.vue likely passes props.
            pass

        # Alternatively, use the 'samples' feature if available in UI.
        # Example/src/App.vue likely has logic.

        # Let's try to just use the "Simple join (TEXT format)" sample if there are buttons for it.
        # Or look for a selector that looks like a sample selector.

        # Wait for SVG to render
        try:
             # Wait for at least one path with a title
             page.wait_for_selector("path title", timeout=5000)
        except:
             # If not found, maybe we need to load a sample.
             # Check if there is a select dropdown for samples
             select = page.locator("select.form-select")
             if select.count() > 0:
                 select.select_option(index=1) # Select first sample

             # Wait again
             page.wait_for_selector("path title")

        # Get all titles inside paths
        titles = page.locator("path > title")
        count = titles.count()
        print(f"Found {count} tooltips on paths")

        # Verify content of one tooltip
        if count > 0:
            text = titles.first.text_content()
            print(f"First tooltip text: {text}")
            if "Rows:" not in text:
                print("FAILED: Tooltip does not contain 'Rows:'")
                exit(1)
        else:
            print("FAILED: No tooltips found")
            # Take screenshot for debug
            page.screenshot(path="debug_failed.png")
            exit(1)

        # Take screenshot of the diagram
        page.screenshot(path="verification_tooltip.png")
        print("Verification successful, screenshot saved to verification_tooltip.png")

        browser.close()

if __name__ == "__main__":
    verify_tooltip()
