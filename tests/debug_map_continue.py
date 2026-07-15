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
        print("Clicking wax seal to open envelope...")
        page.wait_for_selector("#wax-seal-btn")
        page.click("#wax-seal-btn")
        page.wait_for_timeout(4000)
        
        # Navigate to Slide 1 (Ubicación)
        print("Navigating to slide 1...")
        dots = page.locator("#slide-nav-dots .nav-dot").all()
        dots[1].click()
        page.wait_for_timeout(1000)
        
        # Check active slide ID
        active_id = page.locator(".invitation-slide.active").get_attribute('id')
        print(f"Active slide ID is now: {active_id}")
        
        # Click 'Cómo llegar' button on slide-1
        print("Clicking 'Cómo llegar' on slide-1...")
        page.locator("#btn-party-maps-url").click()
        page.wait_for_timeout(1000)
        
        # Click "CONTINUAR" in the map modal
        print("Clicking 'CONTINUAR' on map modal...")
        page.locator("#btn-map-continue").click()
        page.wait_for_timeout(2000)
        
        # Check active slide ID after clicking continue
        active_id_after = page.locator(".invitation-slide.active").get_attribute('id')
        print(f"Active slide ID after map continue is: {active_id_after}")
        
        browser.close()

if __name__ == "__main__":
    run_test()
