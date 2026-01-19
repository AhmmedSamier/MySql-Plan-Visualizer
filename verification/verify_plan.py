from playwright.sync_api import Page, expect, sync_playwright

mysql_complex_join = """-> Nested loop inner join  (cost=3.55 rows=4) (actual time=0.120..0.210 rows=4 loops=1)
    -> Nested loop inner join  (cost=1.75 rows=2) (actual time=0.060..0.105 rows=2 loops=1)
        -> Index lookup on users using PRIMARY (id=42)  (cost=0.35 rows=1) (actual time=0.030..0.032 rows=1 loops=1)
        -> Index lookup on orders using customer_id (customer_id=42)  (cost=1.15 rows=2) (actual time=0.025..0.065 rows=2 loops=1)
    -> Index lookup on order_items using order_id (order_id=orders.id)  (cost=0.75 rows=2) (actual time=0.020..0.045 rows=2 loops=1)
"""

mysql_complex_join_query = """SELECT u.username, o.order_date, oi.product_name
FROM users u
JOIN orders o ON u.id = o.customer_id
JOIN order_items oi ON o.id = oi.order_id
WHERE u.id = 42;"""

def verify_plan(page: Page):
    # 1. Arrange: Go to the app.
    page.goto("http://localhost:5173")

    # 2. Act: Fill inputs and submit.
    page.fill("#planInput", mysql_complex_join)
    page.fill("#queryInput", mysql_complex_join_query)

    # Click visualize
    page.click("button[type=submit]")

    # 3. Assert: Wait for plan visualization to appear.
    # We expect some node to be visible. "Nested loop inner join" should be visible in the diagram.
    # The diagram renders nodes. Let's wait for a text "Nested loop inner join".
    expect(page.get_by_text("Nested loop inner join").first).to_be_visible()

    # 4. Screenshot: Capture the result.
    # Wait a bit for animation
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_plan(page)
            print("Verification successful!")
        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="/home/jules/verification/failure.png")
            raise e
        finally:
            browser.close()
