"""Collect the latest definition of selected SQL functions from the migrations.

Used by supabase/tests/run_sparring_edit.sh to build a throwaway local test DB
with the production function bodies (migration order = file name order).
"""
import pathlib
import re
import sys

MIGRATIONS = pathlib.Path(__file__).resolve().parent.parent / 'migrations'


def extract(names: list[str], until: str | None) -> str:
    latest: dict[str, str] = {}
    for f in sorted(MIGRATIONS.glob('*.sql')):
        if until is not None and f.name > until:
            continue
        sql = f.read_text()
        for m in re.finditer(r'CREATE OR REPLACE FUNCTION (?:public\.)?(\w+)\s*\(', sql, re.IGNORECASE):
            name = m.group(1)
            if name not in names:
                continue
            tag_m = re.compile(r'AS\s+(\$\w*\$)', re.IGNORECASE).search(sql, m.end())
            tag = tag_m.group(1)
            end = sql.index(tag, tag_m.end()) + len(tag)
            semi = sql.index(';', end) + 1
            latest[name] = sql[m.start():semi]
    missing = [n for n in names if n not in latest]
    if missing:
        sys.exit(f'missing functions: {missing}')
    return '\n\n'.join(latest[n] for n in names)


if __name__ == '__main__':
    until = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != '-' else None
    print(extract(sys.argv[2].split(','), until))
