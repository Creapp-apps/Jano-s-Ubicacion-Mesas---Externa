import sys
from playwright.sync_api import sync_playwright

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console logs
        page.on("console", lambda msg: print(f"[Console] {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"[Page Error]: {err}"))
        
        url = "http://localhost:3000/invitacion?event=xvmica"
        print(f"Navigating to {url}...")
        page.goto(url)
        page.wait_for_load_state("networkidle")
        
        # Click the wax seal
        print("Opening envelope...")
        page.wait_for_selector("#wax-seal-btn")
        page.click("#wax-seal-btn")
        page.wait_for_timeout(4000)
        
        # Print dots
        dots = page.locator("#slide-nav-dots .nav-dot").all()
        print(f"Total navigation dots: {len(dots)}")
        for idx, dot in enumerate(dots):
            slide_attr = dot.get_attribute("data-slide")
            print(f"Dot {idx} has data-slide={slide_attr}")
            
        # Trace sequential next button clicks
        print("\nTracing sequential slides via next button:")
        for step in range(10):
            active_id = page.locator(".invitation-slide.active").get_attribute('id')
            print(f"Step {step}: Active slide is: {active_id}")
            
            # Click next button if not disabled
            next_btn = page.locator("#btn-slide-next")
            if next_btn.is_disabled():
                print("Next button is disabled. Reached end of deck.")
                break
            next_btn.click()
            page.wait_for_timeout(1000)
            
        browser.close()

if __name__ == "__main__":
    run_test()
