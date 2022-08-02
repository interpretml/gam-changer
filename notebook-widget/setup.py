#!/usr/bin/env python

"""The setup script."""

from setuptools import setup, find_packages

with open("README.md") as readme_file:
    readme = readme_file.read()

requirements = ["numpy", "pandas", "ipython"]

test_requirements = []

setup(
    author="Jay Wang",
    author_email="jayw@zijie.wang",
    python_requires=">=3.6",
    classifiers=[
        "Development Status :: 2 - Pre-Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Natural Language :: English",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
    ],
    description="A Python package to run GAM Changer in your computation notebooks.",
    install_requires=requirements,
    license="MIT license",
    long_description=readme,
    include_package_data=True,
    keywords="gamchanger",
    name="gamchanger",
    packages=find_packages(include=["gamchanger", "gamchanger.*"]),
    test_suite="tests",
    tests_require=test_requirements,
    url="https://github.com/xiaohk/gam-changer",
    version="0.1.6",
    zip_safe=False,
)
