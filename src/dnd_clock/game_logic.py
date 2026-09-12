import time
from . import timers as tm

def calculate_initiatives(mode="proportional", interval=30, ranks=None, min_seconds=None, max_seconds=None):
    """Business logic for initiative sorting and assigning cooldowns.
    
    In cooldown combat: Lower initiative rank gets shorter cooldown (acts more frequently).
    """
    if not ranks:
        return None
        
    valid_ranks = {int(k): int(v) for k, v in ranks.items() if int(k) in tm.timers}
    if not valid_ranks:
        return None

    if min_seconds is not None and max_seconds is not None:
        # Lower initiative numbers should get lower cooldowns.
        unique_ranks = sorted(list(set(valid_ranks.values())))
        num_unique = len(unique_ranks)
        
        now = time.time()
        for k_int, rank in valid_ranks.items():
            t = tm.timers[k_int]
            if num_unique > 1:
                idx = unique_ranks.index(rank)
                time_val = int(min_seconds) + idx * (int(max_seconds) - int(min_seconds)) / (num_unique - 1)
            else:
                time_val = int(min_seconds)
                
            t["remaining"] = 0
            t["duration"] = int(time_val)
            t["cooldown_duration"] = int(time_val)
            t["running"] = False
            t["last_update"] = now
            t["finished"] = True
            
            if k_int in tm.finish_order:
                tm.finish_order.remove(k_int)
                
        tm.save_current_state()
        return None
        
    max_rank = max(valid_ranks.values())
    min_rank = min(valid_ranks.values())
    
    now = time.time()
    for k_int, rank in valid_ranks.items():
        t = tm.timers[k_int]
        if max_rank > min_rank:
            time_val = (rank - min_rank) / (max_rank - min_rank) * tm.DEFAULT_DURATION
        else:
            time_val = 0
            
        t["remaining"] = int(time_val)
        t["duration"] = tm.DEFAULT_DURATION
        t["cooldown_duration"] = tm.DEFAULT_DURATION
        t["running"] = False
        t["last_update"] = now
        t["finished"] = False
        
        if k_int in tm.finish_order:
            tm.finish_order.remove(k_int)
            
    tm.save_current_state()
    return None
