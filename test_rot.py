def next_orient(o):
    m = {
        "R0": "R180",
        "R180": "R0",
        "R90": "R270",
        "R270": "R90",
        "MX": "MY",
        "MY": "MX",
        "MYR90": "MXR90",
        "MXR90": "MYR90"
    }
    return m.get(o, o)
