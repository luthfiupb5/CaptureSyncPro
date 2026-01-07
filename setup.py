from setuptools import setup, find_packages

setup(
    name="capturesync",
    version='5.0',
    description="Automated Image Overlay & Cloud Sync Tool",
    author="Luthfi Bassam U P",
    url="https://github.com/luthfiupb5/CaptureSync",
    packages=find_packages(),
    install_requires=[
        "watchdog",
        "Pillow",
        "rich"
    ],
    entry_points={
        "console_scripts": [
            "capturesync=capturesync.main:main",
        ],
    },
    python_requires=">=3.8",
)
