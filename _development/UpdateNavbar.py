import os
from bs4 import BeautifulSoup
from bs4.formatter import HTMLFormatter

def get_htmls_from_dir(dir_path: str):
    htmls = []
    for path in os.listdir(dir_path):
        if path.endswith('.html'):
            htmls.append(path)
        elif os.path.isdir(path):
            otherHTMLS = get_htmls_from_dir(path)
            if len(otherHTMLS) > 0:
                htmls += otherHTMLS
    return htmls


def find_and_replace_nav_tag(file_path, nav_file_path):
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return
    if not os.path.exists(nav_file_path) or not os.path.isfile(nav_file_path):
        return
    
    formatter = HTMLFormatter(indent=4)
    full_nav_path = os.path.abspath(nav_file_path)
    full_path = os.path.abspath(file_path)

    if full_path == full_nav_path:
        return  # We don't want to overwrite the nav file
    print(full_path)
    print(full_nav_path)
    # return

    nav_content = ""
    with open(full_nav_path, 'r', encoding='utf-8') as f:
        nav_content = f.read()
    nav_soup = BeautifulSoup(nav_content, 'html.parser')
    
    content = ""
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    soup = BeautifulSoup(content, 'html.parser')
    
    nav_tag_to_copy = nav_soup.find('nav', class_='navbar')
    nav_tag = soup.find('nav', class_='navbar')
    if nav_tag and nav_tag_to_copy:
        nav_tag.clear()
        nav_tag.replace_with(nav_tag_to_copy)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(soup.prettify(formatter=formatter))


if __name__ == "__main__":
    main_dir = os.path.abspath("./")
    nav_bar_path = "./General/navbar.html"
    allHTMLPaths = get_htmls_from_dir(main_dir)
    for path in allHTMLPaths:
        find_and_replace_nav_tag(path, nav_bar_path)
    
